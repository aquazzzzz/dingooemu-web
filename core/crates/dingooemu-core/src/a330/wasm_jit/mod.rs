//! Browser backend for A330. Shares only the compilation bridge with A320.
#[path = "../../a320/wasm_jit/bridge.rs"]
mod bridge;
pub(super) mod code_guard;
mod emitter;
#[cfg(all(test, not(target_os = "emscripten")))]
mod tests;

use super::{
    cpu::{Cpu, DecodedArmInstruction},
    memory::Memory,
};
const SLOTS: usize = 2048;
use std::collections::HashMap;
const HOT: u16 = 128;
const MAX_REQUESTS: usize = 320;
const BASE_REQUESTS: usize = 256;
const EXTRA_REQUESTS: usize = 64;

#[derive(Default)]
struct Entry {
    start: u32,
    hits: u16,
    failed: bool,
    // 0=unassigned,1=original cohort,2=extra normal-quantum cohort.
    tier: u8,
    request: u32,
    table: Option<u32>,
    code: Vec<u8>,
}
/// Owning-thread context for one RuntimeBus scheduler segment only.
/// No instance is kept in Engine or serialized. SVC returns rebind before
/// another block; task switches and restore/reset create a fresh segment.
/// Pure generated blocks cannot allocate or replace guest-memory regions.
pub(crate) struct SliceContext {
    #[cfg(target_os = "emscripten")]
    context: emitter::Context,
}
impl SliceContext {
    #[inline(always)]
    pub(crate) fn bind(memory: &mut Memory, program_start: u32, program_end: u32) -> Self {
        #[cfg(target_os = "emscripten")]
        {
            let [ram, stack, heap, framebuffer] = memory.wasm_jit_regions();
            Self {
                context: emitter::Context {
                    registers: 0,
                    cpsr: 0,
                    ram,
                    stack,
                    heap,
                    framebuffer,
                    heap_base: memory.heap_base(),
                    program_start,
                    program_end,
                    homebrew: u32::from(memory.profile() == crate::content::ArmProfile::Homebrew),
                },
            }
        }
        #[cfg(not(target_os = "emscripten"))]
        {
            let _ = (memory, program_start, program_end);
            Self {}
        }
    }
}
pub(crate) enum Execution {
    Fallback,
    Executed(usize),
    // Extra entries replace an interpreter prefix inside its original call.
    ExecutedExtra(usize),
    Stale,
}
pub(crate) struct Engine {
    entries: Vec<Entry>,
    index: HashMap<u32, usize>,
    cursor: usize,
    session: u32,
    shared: bool,
    enabled: bool,
    budget: u8,
    requests: usize,
    request_limit: usize,
    base_submissions: usize,
    extra_requests: usize,
    executions: u64,
    instructions: u64,
    fallbacks: u64,
    invalidations: u64,
    memory_exits: u64,
}
impl Engine {
    pub(crate) fn new() -> Self {
        Self {
            entries: Vec::new(),
            index: HashMap::new(),
            cursor: 0,
            session: bridge::create_limited(MAX_REQUESTS),
            shared: bridge::shared(),
            enabled: true,
            budget: 2,
            requests: 0,
            request_limit: MAX_REQUESTS,
            base_submissions: 0,
            extra_requests: 0,
            executions: 0,
            instructions: 0,
            fallbacks: 0,
            invalidations: 0,
            memory_exits: 0,
        }
    }
    pub(crate) fn enabled(&self) -> bool {
        self.enabled
    }
    pub(crate) fn set_enabled(&mut self, enabled: bool) {
        if !enabled && self.enabled {
            self.clear();
        }
        self.enabled = enabled;
        if enabled && self.session == 0 {
            self.session = bridge::create_limited(self.request_limit);
        }
    }
    pub(crate) fn begin_slice(&mut self) {
        self.budget = 2;
    }
    pub(crate) fn clear(&mut self) {
        if self.session != 0 {
            bridge::clear(self.session);
        }
        self.entries.clear();
        self.index.clear();
        self.cursor = 0;
        self.requests = 0;
        self.base_submissions = 0;
        self.extra_requests = 0;
    }
    pub(crate) fn metric(&self, index: u32) -> f64 {
        match index {
            0 => u32::from(self.enabled && self.session != 0) as f64,
            1 => self.requests as f64,
            2 => self.entries.iter().filter(|e| e.table.is_some()).count() as f64,
            3 => self.executions as f64,
            4 => self.instructions as f64,
            5 => self.fallbacks as f64,
            6 => self.invalidations as f64,
            10 => self.memory_exits as f64,
            20 => self.base_submissions as f64,
            21 => self.extra_requests as f64,
            // Reserved legacy counters for the removed game-specific fold.
            13 | 14 => 0.0,
            _ => -1.0,
        }
    }
    fn entry_index(&mut self, start: u32, hint: &mut usize) -> usize {
        let slot = if self
            .entries
            .get(*hint)
            .is_some_and(|entry| entry.start == start)
        {
            *hint
        } else if let Some(&slot) = self.index.get(&start) {
            slot
        } else {
            let slot = if self.entries.len() < SLOTS {
                let slot = self.entries.len();
                self.entries.push(Entry::default());
                slot
            } else {
                // Keep the original cohort even while stale/failed. At most256
                // base identities plus64 live extra requests occupy2048 slots.
                // Never evict live code or silently reassign a base identity.
                loop {
                    let slot = self.cursor;
                    self.cursor = (slot + 1) % SLOTS;
                    if self.entries[slot].request == 0 && self.entries[slot].tier != 1 {
                        self.index.remove(&self.entries[slot].start);
                        break slot;
                    }
                }
            };
            self.entries[slot] = Entry {
                start,
                ..Entry::default()
            };
            self.index.insert(start, slot);
            slot
        };
        *hint = slot;
        slot
    }
    pub(crate) fn execute(
        &mut self,
        decoded: &[DecodedArmInstruction],
        limit: usize,
        cpu: &mut Cpu,
        memory: &mut Memory,
        context: &mut SliceContext,
        quantum_remaining: usize,
        hint: &mut usize,
    ) -> Execution {
        if !self.enabled || self.session == 0 || limit == 0 {
            return Execution::Fallback;
        }
        self.fallbacks += 1;
        let start = cpu.r[15];
        let slot = self.entry_index(start, hint);
        let e = &mut self.entries[slot];
        if e.failed {
            return Execution::Fallback;
        }
        if e.request != 0 {
            // Full byte comparison also catches frontend writes through exposed
            // libretro RAM, which bypass the emulated bus's invalidation hooks.
            if !memory.code_matches(start, &e.code) {
                bridge::forget(self.session, e.request);
                self.requests -= 1;
                if e.tier == 2 {
                    self.extra_requests -= 1;
                }
                let tier = e.tier;
                *e = Entry {
                    start,
                    tier,
                    ..Entry::default()
                };
                self.invalidations += 1;
                return Execution::Stale;
            }
            // Validate first, even when extra execution is suppressed: external
            // writes must still invalidate the decoded interpreter cache.
            if e.tier == 2 && quantum_remaining as u64 <= super::runtime::SUPPLEMENTAL_QUANTUM {
                return Execution::Fallback;
            }
            if e.table.is_none() {
                match bridge::poll(self.session, e.request) {
                    0 => return Execution::Fallback,
                    -1 => {
                        bridge::forget(self.session, e.request);
                        self.requests -= 1;
                        if e.tier == 2 {
                            self.extra_requests -= 1;
                        }
                        e.request = 0;
                        e.failed = true;
                        return Execution::Fallback;
                    }
                    table => e.table = Some(table as u32 - 1),
                }
            }
            if limit < e.code.len() / 4 {
                return Execution::Fallback;
            }
            #[cfg(target_os = "emscripten")]
            {
                // Pass addresses from this call's exclusive borrow directly.
                type Function =
                    unsafe extern "C" fn(*mut emitter::Context, u32, *mut u32, *mut u32) -> u64;
                let function: Function = unsafe { std::mem::transmute(e.table.unwrap() as usize) };
                let result = unsafe {
                    function(
                        &mut context.context,
                        limit.min(u32::MAX as usize) as u32,
                        cpu.r.as_mut_ptr(),
                        &mut cpu.cpsr,
                    )
                };
                let completed = result as u32 as usize;
                if result >> 32 == 1 {
                    self.memory_exits += 1;
                }
                if completed != 0 {
                    cpu.instruction_count = cpu.instruction_count.wrapping_add(completed as u64);
                    self.instructions += completed as u64;
                    self.executions += 1;
                    self.fallbacks -= 1;
                    return if e.tier == 2 {
                        Execution::ExecutedExtra(completed)
                    } else {
                        Execution::Executed(completed)
                    };
                }
            }
            #[cfg(not(target_os = "emscripten"))]
            let _ = context;
            return Execution::Fallback;
        }
        e.hits = e.hits.saturating_add(1);
        if e.hits < HOT || self.budget == 0 || self.requests >= self.request_limit {
            return Execution::Fallback;
        }
        let extra = e.tier == 2 || (e.tier == 0 && self.base_submissions >= BASE_REQUESTS);
        if extra
            && (self.extra_requests >= EXTRA_REQUESTS
                || quantum_remaining as u64 <= super::runtime::SUPPLEMENTAL_QUANTUM)
        {
            return Execution::Fallback;
        }
        let count = emitter::prefix_len(decoded);
        if count < if extra { 8 } else { 2 } {
            e.failed = true;
            return Execution::Fallback;
        }
        let code: Vec<u8> = decoded[..count]
            .iter()
            .flat_map(|d| d.instruction.to_le_bytes())
            .collect();
        if !memory.code_matches(start, &code) {
            self.invalidations += 1;
            return Execution::Stale;
        }
        let module = emitter::emit(start, &decoded[..count], self.shared);
        self.budget -= 1;
        let request = bridge::submit(self.session, &module);
        if request == 0 {
            e.failed = true;
            return Execution::Fallback;
        }
        if e.tier == 0 {
            e.tier = if extra {
                2
            } else {
                self.base_submissions += 1;
                1
            };
        }
        if e.tier == 2 {
            self.extra_requests += 1;
        }
        e.code = code;
        e.request = request;
        self.requests += 1;
        Execution::Fallback
    }
}
impl Drop for Engine {
    fn drop(&mut self) {
        if self.session != 0 {
            bridge::release(self.session);
        }
    }
}

#[cfg(all(test, not(target_os = "emscripten")))]
mod supplement_tests;
