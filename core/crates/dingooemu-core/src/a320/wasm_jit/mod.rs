//! Experimental browser JIT. Native Cranelift and this backend are independent.
//! Integer/RAM prefixes and bounded single-store self-loops are compiled.
mod bridge;
mod emitter;
#[cfg(all(test, not(target_os = "emscripten")))]
mod tests;

use super::{cpu::Cpu, memory::Memory};
use std::collections::HashMap;

const HOT_THRESHOLD: u16 = 256;
const MIN_BLOCK_LENGTH: usize = 4;
const MAX_ENTRIES: usize = 2048;
const MAX_REQUESTS: usize = 256;
const COMPILES_PER_FRAME: u8 = 2;

#[cfg(test)]
pub(crate) fn test_prefix_len(words: &[u32]) -> usize {
    emitter::prefix_len(words)
}

#[cfg(feature = "wasm-jit-profile")]
pub(crate) fn profile_prefix_len(words: &[u32]) -> usize {
    emitter::prefix_len(words)
}

#[cfg(target_os = "emscripten")]
type BlockFunction = unsafe extern "C" fn(*mut emitter::Context, u32) -> u64;

#[derive(Default)]
struct Entry {
    start: u32,
    hits: u16,
    failed: bool,
    request: u32,
    table_index: Option<u32>,
    code: Vec<u8>,
    branch: bool,
}

// Dense cached entry hints are read on every dispatch. Keep their wasm32
// stride unchanged when extending the generated module's control-flow scope.
#[cfg(target_os = "emscripten")]
const _: () = assert!(std::mem::size_of::<Entry>() == 32);

/// An instruction-cache block can remember its dense JIT entry. The generation
/// and PC checks prevent reuse after clear, refetch or an interpreter collision.
#[derive(Default, Clone, Copy)]
pub(crate) struct CacheHint {
    generation: u64,
    index: usize,
    start: u32,
    unsupported: bool,
}

pub(crate) enum Execution {
    Fallback,
    Executed(u64),
    StaleCode,
}

pub(crate) struct Engine {
    session: u32,
    enabled: bool,
    shared: bool,
    entries: HashMap<u32, usize>,
    slots: Vec<Entry>,
    generation: u64,
    budget: u8,
    requests: usize,
    executions: u64,
    instructions: u64,
    invalidations: u64,
    hint_hits: u64,
    lookups: u64,
    unsupported_dispatches: u64,
    memory_exits: u64,
    branch_executions: u64,
    evictions: u64,
    eviction_cursor: usize,
    #[cfg(feature = "wasm-jit-profile")]
    profile: super::profile::CacheProfile,
}

impl Engine {
    pub(crate) fn new() -> Self {
        Self {
            session: bridge::create(),
            enabled: true,
            shared: bridge::shared(),
            entries: HashMap::new(),
            slots: Vec::new(),
            generation: 1,
            budget: COMPILES_PER_FRAME,
            requests: 0,
            executions: 0,
            instructions: 0,
            invalidations: 0,
            hint_hits: 0,
            lookups: 0,
            unsupported_dispatches: 0,
            memory_exits: 0,
            branch_executions: 0,
            evictions: 0,
            eviction_cursor: 0,
            #[cfg(feature = "wasm-jit-profile")]
            profile: super::profile::CacheProfile::default(),
        }
    }

    #[inline]
    pub(crate) fn is_enabled(&self) -> bool {
        self.enabled && self.session != 0
    }

    pub(crate) fn set_enabled(&mut self, enabled: bool) {
        if !enabled && self.enabled {
            self.clear_for(1);
        }
        if enabled && self.session == 0 {
            self.session = bridge::create();
        }
        self.enabled = enabled;
    }

    pub(crate) fn begin_frame(&mut self) {
        self.budget = COMPILES_PER_FRAME;
    }

    pub(crate) fn metric(&self, index: u32) -> f64 {
        match index {
            0 => u32::from(self.enabled && self.session != 0) as f64,
            1 => self.requests as f64,
            2 => self
                .slots
                .iter()
                .filter(|entry| entry.table_index.is_some())
                .count() as f64,
            3 => self.executions as f64,
            4 => self.instructions as f64,
            // Every enabled dispatch either rejects a short prefix, uses a
            // dense hint or performs one lookup. Sum that partition on demand
            // instead of incrementing an overlapping total on every call.
            5 => (self.hint_hits + self.lookups + self.unsupported_dispatches)
                .saturating_sub(self.executions) as f64,
            6 => self.invalidations as f64,
            7 => self.hint_hits as f64,
            8 => self.lookups as f64,
            9 => self.unsupported_dispatches as f64,
            10 => self.memory_exits as f64,
            11 => self.evictions as f64,
            12 => self.branch_executions as f64,
            _ => -1.0,
        }
    }

    pub(crate) fn clear(&mut self) {
        self.clear_for(0);
    }

    fn clear_for(&mut self, _reason: usize) {
        #[cfg(feature = "wasm-jit-profile")]
        if self.profile.enabled {
            self.profile.clear_reasons[_reason] += 1;
            self.profile.discarded_requests += self.requests as u64;
            self.profile.discarded_ready += self
                .slots
                .iter()
                .filter(|entry| entry.table_index.is_some())
                .count() as u64;
        }
        if self.session != 0 {
            bridge::clear(self.session);
        }
        self.invalidations += 1;
        self.entries.clear();
        self.slots.clear();
        self.eviction_cursor = 0;
        self.generation = self
            .generation
            .checked_add(1)
            .expect("JIT generation exhausted");
        self.requests = 0;
    }

    fn entry_index(&mut self, start: u32, hint: &mut CacheHint) -> usize {
        if hint.generation == self.generation
            && self
                .slots
                .get(hint.index)
                .is_some_and(|entry| entry.start == start)
        {
            self.hint_hits += 1;
            return hint.index;
        }
        self.lookups += 1;
        let index = if let Some(&index) = self.entries.get(&start) {
            index
        } else {
            let index = if self.slots.len() < MAX_ENTRIES {
                let index = self.slots.len();
                self.slots.push(Entry::default());
                index
            } else {
                // At most MAX_REQUESTS slots can own a request. Recycle only
                // unsubmitted/failed entries; preserve compiled and pending code.
                // PC validation below rejects hints into a repurposed slot.
                let index = loop {
                    let index = self.eviction_cursor;
                    self.eviction_cursor = (index + 1) % MAX_ENTRIES;
                    if self.slots[index].request == 0 || self.slots[index].failed {
                        break index;
                    }
                };
                self.entries.remove(&self.slots[index].start);
                self.evictions += 1;
                #[cfg(feature = "wasm-jit-profile")]
                if self.profile.enabled {
                    self.profile.evictions += 1;
                }
                index
            };
            self.slots[index] = Entry {
                start,
                ..Entry::default()
            };
            self.entries.insert(start, index);
            index
        };
        *hint = CacheHint {
            generation: self.generation,
            index,
            start,
            unsupported: false,
        };
        index
    }

    fn rejects_short_prefix(&self, start: u32, instructions: &[u32], hint: &mut CacheHint) -> bool {
        if hint.generation == self.generation && hint.start == start {
            return hint.unsupported;
        }
        if emitter::prefix_len(instructions) < MIN_BLOCK_LENGTH {
            // Classification belongs to the fetched interpreter-cache block,
            // not the bounded hot-entry table. Refetch/clear invalidates the hint.
            *hint = CacheHint {
                generation: self.generation,
                index: usize::MAX,
                start,
                unsupported: true,
            };
            return true;
        }
        false
    }

    pub(crate) fn execute(
        &mut self,
        start: u32,
        instructions: &[u32],
        limit: usize,
        cpu: &mut Cpu,
        memory: &mut Memory,
        hint: &mut CacheHint,
    ) -> Execution {
        #[cfg(not(target_os = "emscripten"))]
        let _ = cpu;
        if !self.enabled || self.session == 0 || limit == 0 || cpu.branch_delay {
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(0);
            return Execution::Fallback;
        }
        if self.rejects_short_prefix(start, instructions, hint) {
            self.unsupported_dispatches += 1;
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(4);
            return Execution::Fallback;
        }
        let index = self.entry_index(start, hint);
        let entry = &mut self.slots[index];
        if entry.failed {
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(4);
            return Execution::Fallback;
        }
        if entry.request != 0 {
            // Check the complete prefix on every call, even while compilation
            // is pending. This also detects writes through frontend RAM pointers.
            if !memory.instruction_bytes_match(start, &entry.code) {
                #[cfg(feature = "wasm-jit-profile")]
                if self.profile.enabled {
                    self.profile.code_mismatches += 1;
                }
                bridge::forget(self.session, entry.request);
                self.requests -= 1;
                *entry = Entry {
                    start,
                    ..Entry::default()
                };
                *hint = CacheHint::default();
                return Execution::StaleCode;
            }
            if entry.table_index.is_none() {
                match bridge::poll(self.session, entry.request) {
                    -1 => {
                        #[cfg(feature = "wasm-jit-profile")]
                        self.profile.fallback(4);
                        bridge::forget(self.session, entry.request);
                        entry.request = 0;
                        self.requests -= 1;
                        entry.failed = true;
                        return Execution::Fallback;
                    }
                    0 => {
                        #[cfg(feature = "wasm-jit-profile")]
                        self.profile.fallback(5);
                        return Execution::Fallback;
                    }
                    value => entry.table_index = Some(value as u32 - 1),
                }
            }
            let instruction_count = entry.code.len() / 4;
            if limit < instruction_count {
                #[cfg(feature = "wasm-jit-profile")]
                self.profile.fallback(6);
                return Execution::Fallback;
            }
            #[cfg(target_os = "emscripten")]
            {
                // wasm32 C function pointers are indices into this runtime's
                // indirect function table. The bridge only installs ABI-v4 funcs.
                let function: BlockFunction =
                    unsafe { std::mem::transmute(entry.table_index.unwrap() as usize) };
                let (delay, target, pending) = if entry.branch {
                    cpu.wasm_jit_branch_state()
                } else {
                    (0, 0, 0)
                };
                let mut context = emitter::Context {
                    registers: &mut cpu.regs as *mut super::cpu::Registers as u32,
                    ram: memory.system_ram_mut().as_mut_ptr() as u32,
                    store_address: 0,
                    store_size: 0,
                    branch_delay: delay,
                    branch_target: target,
                    branch_pending: pending,
                    framebuffer: memory.framebuffer_mut().as_mut_ptr() as u32,
                };
                let result = unsafe { function(&mut context, limit as u32) };
                let completed = result & u64::from(u32::MAX);
                let reason = result & !u64::from(u32::MAX);
                if reason == emitter::EXIT_MEMORY {
                    self.memory_exits += 1;
                }
                if completed != 0
                    && ((reason == emitter::EXIT_FALLTHROUGH
                        && completed == instruction_count as u64)
                        || (reason == emitter::EXIT_MEMORY && completed < instruction_count as u64))
                {
                    if entry.branch {
                        if completed >= instruction_count as u64 - 1 {
                            self.branch_executions += 1;
                        }
                        cpu.commit_wasm_jit_branch_state(
                            context.branch_delay,
                            context.branch_target,
                            context.branch_pending,
                        );
                    }
                    if context.store_size != 0 {
                        memory.wasm_jit_track_write(
                            context.store_address,
                            context.store_size as usize,
                        );
                    }
                    self.executions += 1;
                    self.instructions += completed;
                    return Execution::Executed(completed);
                }
                return self.complete_repeated_exit(
                    &context,
                    completed,
                    reason,
                    instruction_count,
                    limit,
                    cpu,
                    memory,
                );
            }
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(7);
            return Execution::Fallback;
        }

        // Hotness only selects a first compilation request. Submitted blocks
        // do not need another counter update on each generated-function call.
        entry.hits = entry.hits.saturating_add(1);
        if entry.hits < HOT_THRESHOLD || self.budget == 0 || self.requests >= MAX_REQUESTS {
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(if entry.hits < HOT_THRESHOLD {
                1
            } else if self.budget == 0 {
                2
            } else {
                3
            });
            return Execution::Fallback;
        }
        let count = emitter::prefix_len(instructions);
        if count < MIN_BLOCK_LENGTH {
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(8);
            entry.failed = true;
            return Execution::Fallback;
        }
        let code: Vec<u8> = instructions[..count]
            .iter()
            .flat_map(|word| word.to_le_bytes())
            .collect();
        if !memory.instruction_bytes_match(start, &code) {
            #[cfg(feature = "wasm-jit-profile")]
            if self.profile.enabled {
                self.profile.code_mismatches += 1;
            }
            return Execution::StaleCode;
        }
        let module = emitter::emit(start, instructions, self.shared);
        debug_assert_eq!(module.instructions, count);
        let request = bridge::submit(self.session, &module.bytes);
        if request != 0 {
            entry.branch = module.branch;
            entry.request = request;
            entry.code = code;
            self.requests += 1;
            self.budget -= 1;
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(5);
        } else {
            #[cfg(feature = "wasm-jit-profile")]
            self.profile.fallback(9);
        }
        Execution::Fallback
    }

    // Keep loop-only validation and division out of the ordinary dispatch body.
    // This path is rare relative to individual prefix calls, even in hot loops.
    #[cfg(target_os = "emscripten")]
    #[cold]
    #[inline(never)]
    fn complete_repeated_exit(
        &mut self,
        context: &emitter::Context,
        completed: u64,
        reason: u64,
        instruction_count: usize,
        limit: usize,
        cpu: &mut Cpu,
        memory: &mut Memory,
    ) -> Execution {
        // Ordinary generated prefixes never report more than their static
        // length. Smaller partial exits and a single completed iteration are
        // already handled above. No cache hint needs to survive the call just
        // to identify a multi-iteration exit.
        if completed > instruction_count as u64
            && ((reason == emitter::EXIT_FALLTHROUGH
                && completed <= limit as u64
                && completed % instruction_count as u64 == 0)
                || (reason == emitter::EXIT_MEMORY && completed < limit as u64))
        {
            self.branch_executions += completed / instruction_count as u64
                + u64::from(completed % instruction_count as u64 >= instruction_count as u64 - 1);
            cpu.commit_wasm_jit_branch_state(
                context.branch_delay,
                context.branch_target,
                context.branch_pending,
            );
            if context.store_size != 0 {
                memory.wasm_jit_track_write(context.store_address, context.store_size as usize);
            }
            self.executions += 1;
            self.instructions += completed;
            return Execution::Executed(completed);
        }
        #[cfg(feature = "wasm-jit-profile")]
        self.profile.fallback(7);
        Execution::Fallback
    }

    #[cfg(feature = "wasm-jit-profile")]
    pub(crate) fn profile_begin(&mut self) {
        self.profile = super::profile::CacheProfile {
            enabled: true,
            ..Default::default()
        };
    }
    #[cfg(feature = "wasm-jit-profile")]
    pub(crate) fn profile_end(&mut self) -> serde_json::Value {
        self.profile.enabled = false;
        self.profile.report()
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        if self.session != 0 {
            bridge::release(self.session);
        }
    }
}
