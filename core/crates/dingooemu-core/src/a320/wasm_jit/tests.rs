//! The oracle is the existing CPU, not a second implementation of MIPS in JS.
use super::emitter;
use super::{CacheHint, Engine, MAX_ENTRIES};
use crate::a320::{
    cpu::{Cpu, Registers},
    memory::Memory,
};
use serde_json::{Value, json};
use std::{
    mem::{offset_of, size_of},
    path::PathBuf,
    process::Command,
};

const VALUES: [u32; 12] = [
    0,
    1,
    2,
    31,
    32,
    33,
    0x7fff,
    0x8000,
    0x7fff_ffff,
    0x8000_0000,
    0xffff_fffe,
    0xffff_ffff,
];
const FUNCTIONS: [u32; 14] = [
    0, 2, 3, 4, 6, 7, 0x21, 0x23, 0x24, 0x25, 0x26, 0x27, 0x2a, 0x2b,
];

#[test]
fn code_byte_guard_checks_every_byte_and_frontend_writes() {
    let mut memory = Memory::new();
    let start = 0x8000_1001;
    let expected: Vec<u8> = (0..128).map(|index| (index * 37) as u8).collect();
    memory.system_ram_mut()[0x1001..0x1081].copy_from_slice(&expected);
    for alias in [0x1001, start, 0xa000_1001] {
        assert!(memory.instruction_bytes_match(alias, &expected));
        for index in 0..expected.len() {
            // This intentionally bypasses Memory::write_* just like Libretro RAM.
            memory.system_ram_mut()[0x1001 + index] ^= 1;
            assert!(!memory.instruction_bytes_match(alias, &expected));
            memory.system_ram_mut()[0x1001 + index] ^= 1;
        }
    }
}

#[test]
fn code_byte_guard_matches_word_fetch_across_mapping_boundaries() {
    let mut memory = Memory::new();
    for (index, byte) in memory.system_ram_mut().iter_mut().enumerate() {
        *byte = (index as u32).wrapping_mul(37).wrapping_add(11) as u8;
    }
    for (index, byte) in memory.framebuffer_mut().iter_mut().enumerate() {
        *byte = (index as u32).wrapping_mul(13).wrapping_add(7) as u8;
    }
    let mut starts = vec![
        0,
        1,
        0x1001,
        0x01ff_ff80,
        0x01ff_fffc,
        0x01ff_fffd,
        0x0200_0000,
        0x7fff_fffc,
        0x8000_0000,
        0x8000_0001,
        0x81ff_fffc,
        0x9fff_fffc,
        0xa000_0000,
        0xa000_0001,
        0xa1ff_fffc,
        0xbfff_fffc,
        0xc000_0000,
        0xffff_fffc,
        0xffff_ffff,
        0x1000_2020,
        0x1001_0000,
        0x1308_0004,
    ];
    for base in crate::a320::memory::LCD_FRAMEBUFFER_ALIASES {
        starts.extend([base, base + 1, base + 0x25ffc, base + 0x25ffd]);
    }
    let mut seed = 0x4ab3_91d5u32;
    for _ in 0..512 {
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        starts.push(seed);
        starts.push((seed & 0x01ff_ffff) | 0x8000_0000);
    }
    for start in starts {
        for count in [0, 1, 2, 4, 8, 16, 32] {
            let words: Vec<u32> = (0..count)
                .map(|index| {
                    memory
                        .fetch_instruction(start.wrapping_add(index * 4))
                        .unwrap_or(0xdead_beef)
                })
                .collect();
            let mut bytes: Vec<u8> = words.iter().flat_map(|word| word.to_le_bytes()).collect();
            let oracle = |bytes: &[u8]| {
                bytes.chunks_exact(4).enumerate().all(|(index, bytes)| {
                    memory
                        .fetch_instruction(start.wrapping_add(index as u32 * 4))
                        .ok()
                        == Some(u32::from_le_bytes(bytes.try_into().unwrap()))
                })
            };
            assert_eq!(
                memory.instruction_bytes_match(start, &bytes),
                oracle(&bytes),
                "{start:x}/{count}"
            );
            if let Some(last) = bytes.last_mut() {
                *last ^= 1;
                assert_eq!(
                    memory.instruction_bytes_match(start, &bytes),
                    oracle(&bytes),
                    "changed {start:x}/{count}"
                );
            }
        }
    }
}

#[test]
fn pending_and_ready_code_changes_discard_requests_and_hints() {
    let words = [0x2508_0001; 8];
    let code: Vec<u8> = words
        .iter()
        .flat_map(|word: &u32| word.to_le_bytes())
        .collect();
    for ready in [false, true] {
        for changed in [0, 15, 31] {
            let mut engine = Engine::new();
            engine.session = 1; // Native bridge stubs permit testing guard bookkeeping.
            engine.requests = 1;
            let mut hint = CacheHint::default();
            let slot = engine.entry_index(0x8000_1000, &mut hint);
            engine.slots[slot].request = 7;
            engine.slots[slot].table_index = ready.then_some(1);
            engine.slots[slot].code = code.clone();
            let mut memory = Memory::new();
            memory.system_ram_mut()[0x1000..0x1020].copy_from_slice(&code);
            memory.system_ram_mut()[0x1000 + changed] ^= 1;
            let mut cpu = Cpu::new(0x8000_1000);
            let before = state(&cpu.regs);
            assert!(matches!(
                engine.execute(0x8000_1000, &words, 8, &mut cpu, &mut memory, &mut hint),
                super::Execution::StaleCode
            ));
            assert_eq!(state(&cpu.regs), before);
            assert_eq!(engine.requests, 0);
            assert_eq!(engine.slots[slot].request, 0);
            assert!(engine.slots[slot].code.is_empty());
            assert_eq!(hint.generation, 0);
        }
    }
}

#[test]
fn cache_hint_tracks_pc_and_survives_interpreter_cache_collisions() {
    let mut engine = Engine::new();
    let mut hint = CacheHint::default();
    let first = engine.entry_index(0x8000_1000, &mut hint);
    let saved = hint;
    assert_eq!(engine.entry_index(0x8000_1000, &mut hint), first);
    let second = engine.entry_index(0x8000_5000, &mut hint);
    assert_ne!(first, second);
    // A hint belonging to another PC cannot select its compiled entry.
    assert_eq!(engine.entry_index(0x8000_1000, &mut hint), first);
    let mut retained = saved;
    assert_eq!(engine.entry_index(0x8000_1000, &mut retained), first);
    assert_eq!(engine.metric(7), 2.0);
    assert_eq!(engine.metric(8), 3.0);
}

#[test]
fn clear_invalidates_hints_even_when_slot_and_pc_are_reused() {
    let mut engine = Engine::new();
    let mut hint = CacheHint::default();
    let slot = engine.entry_index(0x8000_1000, &mut hint);
    let generation = hint.generation;
    engine.clear();
    assert_eq!(engine.entry_index(0x8000_1000, &mut hint), slot);
    assert_ne!(hint.generation, generation);
    assert_eq!(engine.metric(7), 0.0);
    assert_eq!(engine.metric(8), 2.0);
}

#[test]
fn entry_cap_recycles_unsubmitted_slots_and_rejects_old_pc_hints() {
    let mut engine = Engine::new();
    let mut old = CacheHint::default();
    engine.entry_index(0x8000_1000, &mut old);
    for index in 1..=MAX_ENTRIES {
        engine.entry_index(0x8000_1000 + index as u32 * 4, &mut CacheHint::default());
    }
    assert_eq!(engine.slots.len(), MAX_ENTRIES);
    assert_eq!(engine.entries.len(), MAX_ENTRIES);
    assert_eq!(engine.metric(6), 0.0);
    assert_eq!(engine.metric(11), 1.0);
    assert_ne!(engine.slots[old.index].start, 0x8000_1000);
    let old_generation = old.generation;
    engine.entry_index(0x8000_1000, &mut old);
    assert_eq!(old.generation, old_generation);
    assert_eq!(engine.slots[old.index].start, 0x8000_1000);
}

#[test]
fn entry_cap_preserves_all_requested_slots_and_pending_words() {
    let mut engine = Engine::new();
    for index in 0..super::MAX_REQUESTS {
        let slot = engine.entry_index(index as u32 * 4, &mut CacheHint::default());
        engine.slots[slot].request = index as u32 + 1;
        engine.slots[slot].code = (index as u32).to_le_bytes().to_vec();
        engine.slots[slot].table_index = (index % 2 == 0).then_some(index as u32 + 1);
    }
    for index in super::MAX_REQUESTS..MAX_ENTRIES * 3 {
        engine.entry_index(index as u32 * 4, &mut CacheHint::default());
    }
    assert_eq!(engine.entries.len(), MAX_ENTRIES);
    assert_eq!(engine.slots.len(), MAX_ENTRIES);
    for index in 0..super::MAX_REQUESTS {
        assert_eq!(engine.slots[index].request, index as u32 + 1);
        assert_eq!(engine.slots[index].code, (index as u32).to_le_bytes());
        assert_eq!(engine.entries.get(&(index as u32 * 4)), Some(&index));
    }
    assert_eq!(engine.metric(6), 0.0);
    assert!(engine.metric(11) > 0.0);
}

#[test]
fn unsupported_prefixes_do_not_consume_hot_entries_or_cross_pc_hints() {
    let mut engine = Engine::new();
    let mut hint = CacheHint::default();
    assert!(engine.rejects_short_prefix(0x1000, &[0x10220001, 0, 0, 0], &mut hint));
    assert!(engine.rejects_short_prefix(0x1000, &[0x10220001, 0, 0, 0], &mut hint));
    assert!(engine.slots.is_empty());
    assert!(engine.entries.is_empty());
    // A direct-mapped interpreter-cache collision cannot reject a different PC.
    assert!(!engine.rejects_short_prefix(0x5000, &[0; 4], &mut hint));
    engine.entry_index(0x5000, &mut hint);
    assert!(!hint.unsupported);
    assert!(engine.rejects_short_prefix(0x1000, &[0x10220001], &mut hint));
}

#[test]
fn mul_is_supported_and_short_prefixes_stay_rejected() {
    for opcode in [0x28u32, 0x29, 0x2b] {
        let store = (opcode << 26) | (1 << 21) | (2 << 16);
        let engine = Engine::new();
        assert!(engine.rejects_short_prefix(
            0x1000,
            &[0x8c23_0000, 0x2463_0001, store, 0],
            &mut CacheHint::default()
        ));
        assert!(engine.rejects_short_prefix(0x1000, &[0, store], &mut CacheHint::default()));
    }
    for words in [vec![0; 3], vec![0x1022_0001, 0], vec![0, 0x1422_0001, 0]] {
        assert!(Engine::new().rejects_short_prefix(0x1000, &words, &mut CacheHint::default()));
    }
    let mul = (0x1c << 26) | (1 << 21) | (2 << 16) | (3 << 11) | 2;
    assert_eq!(emitter::prefix_len(&[mul, 0, 0, 0]), 4);
    for function in [4u32, 5, 0x20, 0x21] {
        assert_eq!(emitter::prefix_len(&[(mul & !63) | function, 0, 0, 0]), 0);
    }
}

#[test]
fn unsupported_hint_is_reclassified_after_clear_or_refetch() {
    let mut engine = Engine::new();
    let mut hint = CacheHint::default();
    assert!(engine.rejects_short_prefix(0x1000, &[0x10220001], &mut hint));
    // Without a refetch, conservative rejection remains a safe fallback.
    assert!(engine.rejects_short_prefix(0x1000, &[0; 4], &mut hint));
    hint = CacheHint::default();
    assert!(!engine.rejects_short_prefix(0x1000, &[0; 4], &mut hint));
    assert!(engine.rejects_short_prefix(0x1000, &[0x10220001], &mut hint));
    engine.clear();
    assert!(!engine.rejects_short_prefix(0x1000, &[0; 4], &mut hint));
    engine.entry_index(0x1000, &mut hint);
    assert!(!hint.unsupported);
}

#[cfg(feature = "wasm-jit-profile")]
#[test]
fn profiling_distinguishes_capacity_disable_and_runtime_clears() {
    let mut engine = Engine::new();
    engine.profile_begin();
    let mut hint = CacheHint::default();
    engine.entry_index(0x8000_1000, &mut hint);
    engine.slots[0].table_index = Some(1);
    engine.slots[0].request = 1;
    engine.requests = 1;
    for index in 1..=MAX_ENTRIES {
        engine.entry_index(0x8000_1000 + index as u32 * 4, &mut CacheHint::default());
    }
    engine.clear();
    engine.set_enabled(false);
    let report = engine.profile_end();
    assert_eq!(report["clearReasons"]["entryCap"], 0);
    assert_eq!(report["unsubmittedEvictions"], 1);
    assert_eq!(report["clearReasons"]["runtime"], 1);
    assert_eq!(report["clearReasons"]["disabled"], 1);
    assert_eq!(report["discardedRequests"], 1);
    assert_eq!(report["discardedReadyEntries"], 1);
    engine.clear();
    assert_eq!(engine.profile.clear_reasons, [1, 1, 0]);
}

fn random(seed: &mut u32) -> u32 {
    *seed ^= *seed << 13;
    *seed ^= *seed >> 17;
    *seed ^= *seed << 5;
    *seed
}

fn state(registers: &Registers) -> Value {
    json!({"gpr": registers.gpr, "pc": registers.pc, "hi": registers.hi, "lo": registers.lo})
}

fn cpu_state(cpu: &Cpu) -> Value {
    let (delay, target, pending) = cpu.wasm_jit_branch_state();
    let mut value = state(&cpu.regs);
    value["branchDelay"] = json!(delay);
    value["branchTarget"] = json!(target);
    value["branchPending"] = json!(pending);
    value
}

fn group(
    name: String,
    start: u32,
    words: &[u32],
    inputs: Vec<Registers>,
    memory: &mut Memory,
) -> Value {
    let count = emitter::prefix_len(words);
    let regular = emitter::emit(start, words, false);
    let shared = emitter::emit(start, words, true);
    assert_eq!(regular.instructions, count);
    assert_eq!(shared.instructions, count);
    let mut cases = Vec::new();
    for input in inputs {
        let mut cpu = Cpu::new(start);
        cpu.regs = input.clone();
        cpu.start();
        for &word in &words[..count] {
            cpu.step_fetched(word, memory).unwrap();
        }
        assert_eq!(cpu.instruction_count, count as u64);
        cases.push(json!({"before": state(&input), "after": cpu_state(&cpu),
            "budget": count, "count": count, "exit": 1}));
    }
    // Guards must leave every byte untouched, including a deliberately dirty R0.
    let mut guard = Registers::new(start);
    guard.gpr.fill(0xdead_beef);
    guard.hi = 0x1234_5678;
    guard.lo = 0x8765_4321;
    cases.push(json!({"before": state(&guard), "after": state(&guard),
        "budget": count - 1, "count": 0, "exit": 2}));
    guard.pc = start.wrapping_add(4);
    cases.push(json!({"before": state(&guard), "after": state(&guard),
        "budget": count, "count": 0, "exit": 3}));
    json!({"name": name, "words": words, "regular": regular.bytes,
        "shared": shared.bytes, "cases": cases})
}

fn ram_patches(memory: &Memory) -> Value {
    json!(
        [
            0usize,
            0x40,
            0x0fc0,
            0x1000,
            0x1040,
            (crate::a320::memory::RAM_SIZE - 64) as usize
        ]
        .map(|offset| {
            json!({"offset": offset, "bytes": &memory.as_slice()[offset..offset + 64]})
        })
    )
}

fn fb_patches(memory: &Memory) -> Value {
    json!([0usize, 0x40, 0xfc0, 0x1000, 0x1040, 0x2000, 0x2020,
        crate::a320::memory::FRAMEBUFFER_MAP_SIZE - 64].map(|offset| {
        json!({"offset": offset, "bytes": &memory.framebuffer()[offset..offset+64]})
    }))
}

fn memory_group(
    name: String,
    words: &[u32],
    input: Registers,
    memory: &mut Memory,
    initial: &[(u32, u32)],
) -> Value {
    memory_group_budget(name, words, input, memory, initial, None)
}

fn memory_group_budget(
    name: String,
    words: &[u32],
    input: Registers,
    memory: &mut Memory,
    initial: &[(u32, u32)],
    budget: Option<usize>,
) -> Value {
    let count = emitter::prefix_len(words);
    memory.as_mut_slice().fill(0);
    memory.framebuffer_mut().fill(0);
    for offset in [0usize,0x1000,0x2000,crate::a320::memory::FRAMEBUFFER_MAP_SIZE-64] {
        for i in 0..64 { memory.framebuffer_mut()[offset+i]=(i as u8).wrapping_mul(97).wrapping_add(0x91); }
    }
    for offset in [
        0usize,
        0x1000,
        (crate::a320::memory::RAM_SIZE - 64) as usize,
    ] {
        for index in 0..64 {
            memory.as_mut_slice()[offset + index] =
                (index as u8).wrapping_mul(73).wrapping_add(0x80);
        }
    }
    for &(address, value) in initial {
        memory.write_u32(address, value).unwrap();
    }
    let budget = budget.unwrap_or(count);
    let repeated = emitter::emit(input.pc, words, false).repeated_loop;
    let before = ram_patches(memory);
    let fb_before = fb_patches(memory);
    let mut cpu = Cpu::new(input.pc);
    cpu.regs = input.clone();
    cpu.start();
    if repeated {
        cpu.commit_wasm_jit_branch_state(0, 0x87654321, 1);
    }
    let before_cpu = cpu_state(&cpu);
    let mut completed = 0;
    let mut reason = 1;
    let mut store_address = 0;
    let mut store_size = 0;
    'outer: while completed as usize + count <= budget {
        for &word in &words[..count] {
            let opcode = word >> 26;
            if opcode >= 0x20 {
                let width = match opcode {
                    0x20 | 0x24 | 0x28 => 1,
                    0x21 | 0x25 | 0x29 => 2,
                    _ => 4,
                };
                let addr = cpu
                    .regs
                    .read(((word >> 21) & 31) as usize)
                    .wrapping_add(word as i16 as i32 as u32);
                let physical = if (0x8000_0000..=0xbfff_ffff).contains(&addr) {
                    addr & 0x1fff_ffff
                } else {
                    addr
                };
                // The emitted fast path exits before a non-RAM operation. Its
                // eventual error/MMIO effect remains the interpreter's responsibility.
                let fb_offset = crate::a320::memory::LCD_FRAMEBUFFER_ALIASES.iter().find_map(|base| {
                    let offset=addr.wrapping_sub(*base);
                    (offset <= crate::a320::memory::FRAMEBUFFER_MAP_SIZE as u32 - width).then_some(offset)
                });
                if physical > crate::a320::memory::RAM_SIZE - width && fb_offset.is_none() {
                    reason = 4;
                    break 'outer;
                }
                if repeated
                    && matches!(opcode, 0x28 | 0x29 | 0x2b)
                    && (0..count * 4).any(|offset| {
                        let code = input.pc.wrapping_add(offset as u32);
                        let code = if (0x8000_0000..=0xbfff_ffff).contains(&code) {
                            code & 0x1fff_ffff
                        } else {
                            code
                        };
                        if let Some(fb)=fb_offset {
                            crate::a320::memory::LCD_FRAMEBUFFER_ALIASES.iter().any(|base| {
                                let offset=input.pc.wrapping_add(offset as u32).wrapping_sub(*base);
                                offset>=fb && offset<fb+width
                            })
                        } else { code >= physical && code < physical + width }
                    })
                {
                    reason = 4;
                    break 'outer;
                }
                if matches!(opcode, 0x28 | 0x29 | 0x2b) {
                    store_address = if fb_offset.is_some() { addr } else { physical };
                    store_size = width;
                }
            }
            cpu.step_fetched(word, memory).unwrap();
            completed += 1;
        }
        if !repeated || cpu.regs.pc != input.pc {
            break;
        }
    }
    if budget < count {
        reason = 2;
    }
    assert_eq!(cpu.instruction_count, completed);
    let mut cases = vec![json!({"before": before_cpu, "after": cpu_state(&cpu),
        "budget": budget, "count": completed, "exit": reason, "ramBefore": before,
        "ramAfter": ram_patches(memory), "fbBefore": fb_before, "fbAfter": fb_patches(memory), "storeAddress": store_address, "storeSize": store_size})];
    let mut guard = input.clone();
    for (budget, exit) in [(count - 1, 2), (count, 3)] {
        if exit == 3 {
            guard.pc = input.pc.wrapping_add(4);
        }
        let mut guard_state = state(&guard);
        for field in ["branchDelay", "branchTarget", "branchPending"] {
            guard_state[field] = before_cpu[field].clone();
        }
        cases.push(
            json!({"before": guard_state, "after": guard_state, "budget": budget,
            "count": 0, "exit": exit, "ramBefore": before, "ramAfter": before, "fbBefore": fb_before, "fbAfter": fb_before,
            "storeAddress": 0, "storeSize": 0}),
        );
    }
    json!({"name": name, "regular": emitter::emit(input.pc, words, false).bytes,
        "shared": emitter::emit(input.pc, words, true).bytes, "cases": cases})
}

fn fixtures() -> Value {
    let mut memory = Memory::new();
    let mut groups = Vec::new();
    let mut seed = 0xd170_0e01;
    // Exercise all supported operations, both signed/unsigned extremes, writes
    // to R0, destination/source aliasing, and immediate encodings across LEB sizes.
    for operation in 0..22 {
        for (variant, (rs, rt, rd)) in [
            (1, 2, 3),
            (1, 2, 1),
            (1, 2, 2),
            (0, 2, 3),
            (1, 0, 3),
            (1, 2, 0),
        ]
        .into_iter()
        .enumerate()
        {
            for immediate in [0u32, 1, 31, 0x7fff, 0x8000, 0xffff] {
                let word = if operation < 14 {
                    (rs << 21)
                        | (rt << 16)
                        | (rd << 11)
                        | ((immediate & 31) << 6)
                        | FUNCTIONS[operation]
                } else if operation == 21 {
                    (0x1c << 26) | (rs << 21) | (rt << 16) | (rd << 11) | 2
                } else {
                    ((0x09 + operation as u32 - 14) << 26) | (rs << 21) | (rt << 16) | immediate
                };
                let mut inputs = Vec::new();
                for (index, value) in VALUES.into_iter().enumerate() {
                    let right_values = if operation == 21 {
                        VALUES.to_vec()
                    } else {
                        vec![VALUES[(index * 5 + variant) % VALUES.len()]]
                    };
                    for right in right_values {
                        let mut regs = Registers::new(0x8000_1000);
                        for reg in &mut regs.gpr {
                            *reg = random(&mut seed);
                        }
                        regs.gpr[1] = value;
                        regs.gpr[2] = right;
                        regs.hi = random(&mut seed);
                        regs.lo = random(&mut seed);
                        inputs.push(regs);
                    }
                }
                groups.push(group(
                    format!("op-{operation}-alias-{variant}-imm-{immediate}"),
                    0x8000_1000,
                    &[word],
                    inputs,
                    &mut memory,
                ));
            }
        }
    }
    // New HI/LO and conditional moves: extremes, dirty R0, all aliases,
    // product/accumulator overflow and dependent reads come from the CPU oracle.
    for (name, operation) in [("mult",0x18), ("multu",0x19), ("madd",0x70000000), ("maddu",0x70000001), ("mfhi",0x10), ("mflo",0x12), ("movz",0x0a), ("movn",0x0b)] {
        for (alias,(rs,rt,rd)) in [(1,2,3),(1,2,1),(1,2,2),(0,2,3),(1,0,3),(1,2,0)].into_iter().enumerate() {
            let word=operation|(rs<<21)|(rt<<16)|(rd<<11);
            let inputs=VALUES.into_iter().flat_map(|a|VALUES.into_iter().map(move |b| {
                let mut regs=Registers::new(0x80001000);regs.gpr.fill(0xdeadbeef);
                regs.gpr[1]=a;regs.gpr[2]=b;regs.hi=a^0x81234567;regs.lo=b^0x89abcdef;regs
            })).collect();
            groups.push(group(format!("hilo-{name}-{alias}"),0x80001000,&[word,0x00001812,0x00002010,0x24840001],inputs,&mut memory));
        }
    }
    for (index,(a,b)) in VALUES.into_iter().flat_map(|a|VALUES.into_iter().map(move |b|(a,b))).enumerate() {
        let mut regs=Registers::new(0x80001000);regs.gpr.fill(0xdeadbeef);regs.gpr[1]=a;regs.gpr[2]=b;
        regs.hi=a;regs.lo=b;
        let words=[0x00220018,0x70220000,0x00001812,0x0061200a,0x0043280b,0x00003010,0x70221802];
        groups.push(group(format!("hilo-chain-{index}"),regs.pc,&words,vec![regs],&mut memory));
    }
    // Data-dependent sequences detect interactions that isolated instructions miss.
    for index in 0..256 {
        let start = [0, 0x8000_1000, 0x7fff_fffc, 0xffff_fffc][index % 4];
        let mut words = Vec::new();
        for _ in 0..(4 + random(&mut seed) as usize % 29) {
            let op = random(&mut seed) % 22;
            let rs = random(&mut seed) % 32;
            let rt = random(&mut seed) % 32;
            let rd = random(&mut seed) % 32;
            let immediate = random(&mut seed) & 65535;
            words.push(if op < 14 {
                (rs << 21)
                    | (rt << 16)
                    | (rd << 11)
                    | ((immediate & 31) << 6)
                    | FUNCTIONS[op as usize]
            } else if op == 21 {
                (0x1c << 26) | (rs << 21) | (rt << 16) | (rd << 11) | 2
            } else {
                ((0x09 + op - 14) << 26) | (rs << 21) | (rt << 16) | immediate
            });
        }
        // Unsupported instructions must stop the prefix without being executed.
        words.push([0x8822_0000, 0x5022_0001, 0x0022_001a, 0x0000_000c][index % 4]);
        words.push(0x2401_ffff);
        let inputs = (0..8)
            .map(|_| {
                let mut regs = Registers::new(start);
                for reg in &mut regs.gpr {
                    *reg = random(&mut seed);
                }
                regs.hi = random(&mut seed);
                regs.lo = random(&mut seed);
                regs
            })
            .collect();
        groups.push(group(
            format!("sequence-{index}"),
            start,
            &words,
            inputs,
            &mut memory,
        ));
    }
    // Capture predicates before aliased delay writes; preserve old target/pending
    // on an untaken branch. Expected state comes from the CPU, including flags.
    for opcode in [4u32, 5] {
        for start in [0x8000_1000u32, 0xffff_fffc, 0x7fff_fffc] {
            for offset in [0u32, 1, 0x7fff, 0x8000, 0xffff] {
                for (rs, rt) in [(1, 2), (1, 1), (0, 1), (1, 0), (0, 0)] {
                    for equal in [false, true] {
                        for delay in [
                            0,
                            0x2421_0001,
                            0x2442_ffff,
                            0x0022_1821,
                            0x7022_0802,
                            0x7022_1002,
                            0x7022_0002,
                        ] {
                            for pending in [0, 1] {
                                let words = [
                                    0x2463_0001,
                                    0x2484_ffff,
                                    (opcode << 26) | (rs << 21) | (rt << 16) | offset,
                                    delay,
                                    0x24a5_0001,
                                ];
                                let mut cpu = Cpu::new(start);
                                cpu.start();
                                cpu.regs.gpr.fill(0xdead_beef);
                                cpu.regs.gpr[1] = 0x8000_0000;
                                cpu.regs.gpr[2] = if equal { cpu.regs.gpr[1] } else { 7 };
                                cpu.regs.hi = 0x1234_5678;
                                cpu.regs.lo = 0x8765_4321;
                                cpu.commit_wasm_jit_branch_state(0, 0xfedc_ba98, pending);
                                let before = cpu_state(&cpu);
                                let count = emitter::prefix_len(&words);
                                assert_eq!(count, 4);
                                for &word in &words[..count] {
                                    cpu.step_fetched(word, &mut memory).unwrap();
                                }
                                let after = cpu_state(&cpu);
                                let mut wrong_pc = before.clone();
                                wrong_pc["pc"] = json!(start.wrapping_add(4));
                                groups.push(json!({"name": format!("branch-{opcode}-{start:x}-{offset:x}-{rs}-{rt}-{equal}-{delay:x}-{pending}"),
                                    "regular": emitter::emit(start, &words, false).bytes,
                                    "shared": emitter::emit(start, &words, true).bytes,
                                    "cases": [
                                        {"before": before, "after": after, "budget": count, "count": count, "exit": 1},
                                        {"before": before, "after": before, "budget": 1, "count": 0, "exit": 2},
                                        {"before": before, "after": before, "budget": count - 1, "count": 0, "exit": 2},
                                        {"before": wrong_pc, "after": wrong_pc, "budget": count, "count": 0, "exit": 3}
                                    ]}));
                            }
                        }
                    }
                }
            }
        }
    }
    let mut memory_groups = Vec::new();
    for (index,address) in [0u32,0x1000,0x1fffffd,0x02000000,0x10000000,0x10025ffd,0x13080004].into_iter().enumerate() {
        let mut input=Registers::new(0x80001000);input.gpr.fill(0xdeadbeef);
        input.gpr[1]=0x80000000;input.gpr[2]=0xffffffff;input.gpr[7]=address;input.hi=0xffffffff;input.lo=0xffffffff;
        for (name,words) in [
            ("before-load",vec![0x00220018,0x70220000,0x00001812,0x8ce40000,0x00002810]),
            ("before-store",vec![0x00220019,0x70220001,0x00001812,0xace30000,0x00002810]),
            ("delay-madd",vec![0x00220018,0x00001812,0x14220001,0x70220000]),
        ] {
            memory_groups.push(memory_group(format!("hilo-partial-{name}-{index}"),&words,input.clone(),&mut memory,&[]));
        }
    }

    for opcode in [0x20u32, 0x21, 0x23, 0x24, 0x25, 0x28, 0x29, 0x2b] {
        let width = match opcode {
            0x20 | 0x24 | 0x28 => 1,
            0x21 | 0x25 | 0x29 => 2,
            _ => 4,
        };
        for segment in [0, 0x8000_0000, 0xa000_0000, 0xc000_0000] {
            for (index, (target, immediate)) in [
                (0u32, 0i16),
                (1, -1),
                (0x1000, i16::MIN),
                (0x1001, i16::MAX),
                (crate::a320::memory::RAM_SIZE - width, 0),
                (crate::a320::memory::RAM_SIZE - width + 1, -1),
                (crate::a320::memory::RAM_SIZE, 0),
                (u32::MAX, 1),
                (0x1000_2020, 0),
                (0x9400_0000, 0),
            ]
            .into_iter()
            .enumerate()
            {
                for rt in [0, 1, 2] {
                    let mut regs = Registers::new(0x8000_1000);
                    regs.gpr.fill(0xdead_beef);
                    regs.gpr[1] = (target | segment).wrapping_sub(immediate as i32 as u32);
                    regs.gpr[2] = 0xf180_7ffe;
                    let word = (opcode << 26) | (1 << 21) | (rt << 16) | immediate as u16 as u32;
                    let words = if index % 2 == 0 {
                        vec![0x2463_0001, 0, word, 0x2484_0001]
                    } else {
                        vec![word, 0x2484_0001]
                    };
                    memory_groups.push(memory_group(
                        format!("memory-{opcode:x}-{segment:x}-{index}-r{rt}"),
                        &words,
                        regs,
                        &mut memory,
                        &[],
                    ));
                }
            }
        }
    }
    for base in [0x94000000u32,0x14000000,0x90000000,0x10000000,0xb4000000,0xb0000000,0x13080000] {
        for opcode in [0x20u32,0x21,0x23,0x24,0x25,0x28,0x29,0x2b] {
            let width=match opcode {0x20|0x24|0x28=>1,0x21|0x25|0x29=>2,_=>4};
            for offset in [0u32,1,0x2020,crate::a320::memory::FRAMEBUFFER_MAP_SIZE as u32-width,
                crate::a320::memory::FRAMEBUFFER_MAP_SIZE as u32-width+1,crate::a320::memory::FRAMEBUFFER_MAP_SIZE as u32,u32::MAX] {
                for rt in [0u32,1,2] {
                    let mut regs=Registers::new(0x80001000); regs.gpr.fill(0xdeadbeef);
                    regs.gpr[1]=base.wrapping_add(offset); regs.gpr[2]=0xf1807ffe;
                    memory_groups.push(memory_group(format!("framebuffer-{base:x}-{opcode:x}-{offset:x}-{rt}"),
                        &[0x24630001,0,(opcode<<26)|(1<<21)|(rt<<16),0x24840001],regs,&mut memory,&[]));
                }
            }
        }
    }
    // The alias code address must be guarded before a repeated framebuffer store.
    if !cfg!(debug_assertions) {
        for code_base in crate::a320::memory::LCD_FRAMEBUFFER_ALIASES {
            for data_base in crate::a320::memory::LCD_FRAMEBUFFER_ALIASES {
                for offset in [0x1000u32,0x1001,0x1040,crate::a320::memory::FRAMEBUFFER_MAP_SIZE as u32-2] {
                    let mut regs=Registers::new(code_base+0x1000); regs.gpr[5]=data_base+offset; regs.gpr[3]=0xdeadbeef; regs.gpr[4]=3;
                    let words=[0x24630001,0xa4a30000,0x2484ffff,0x1480fffc,0];
                    memory_groups.push(memory_group_budget(format!("framebuffer-loop-{code_base:x}-{data_base:x}-{offset:x}"),&words,regs,&mut memory,&[],Some(15)));
                }
            }
        }
    }
    // A first load changes the base register of the next access; the final store
    // must stop before a following arithmetic operation.
    let mut regs = Registers::new(0x8000_1000);
    regs.gpr[1] = 0x8000_1000;
    regs.gpr[2] = 0x1234_5678;
    memory_groups.push(memory_group(
        "dependent-load-partial-exit".into(),
        &[0x8c21_0000, 0x8c23_0000, 0xac22_0004, 0x2484_0001],
        regs.clone(),
        &mut memory,
        &[],
    ));
    memory_groups.push(memory_group(
        "dependent-load-store".into(),
        &[0x8c21_0000, 0x8c23_0000, 0xac22_0004, 0x2484_0001],
        regs.clone(),
        &mut memory,
        &[(0x1000, 0x8000_1008)],
    ));
    // Dirty values must be committed at a mid-block RAM guard, while the
    // failing load must not overwrite its destination or commit later work.
    for address in [0x8000_1000, 0x1000_2020] {
        let mut input = regs.clone();
        input.gpr[1] = address;
        memory_groups.push(memory_group(
            format!("cached-register-partial-exit-{address:x}"),
            &[
                0x2442_0001,
                0x2442_0002,
                0x2442_fffe,
                0x8c22_0000,
                0x2442_0001,
                0x8c42_0000,
                0x2463_0001,
            ],
            input,
            &mut memory,
            &[],
        ));
    }
    for branch_opcode in [4u32, 5] {
        for equal in [false, true] {
            for opcode in [0x20u32, 0x21, 0x23, 0x24, 0x25, 0x28, 0x29, 0x2b] {
                for address in [
                    0x1000,
                    0x8000_1001,
                    0xa1ff_fffc,
                    0x01ff_ffff,
                    0x1000_2020,
                    0xc000_0000,
                ] {
                    for rt in [0u32, 1, 2] {
                        let mut input = Registers::new(0x8000_1000);
                        input.gpr.fill(0xdead_beef);
                        input.gpr[1] = 7;
                        input.gpr[2] = if equal { 7 } else { 11 };
                        input.gpr[5] = address;
                        let branch = (branch_opcode << 26) | (1 << 21) | (2 << 16) | 0xfffb;
                        let delay = (opcode << 26) | (5 << 21) | (rt << 16);
                        memory_groups.push(memory_group(
                            format!(
                                "branch-memory-{branch_opcode}-{equal}-{opcode:x}-{address:x}-r{rt}"
                            ),
                            &[0x2463_0001, 0x2484_ffff, branch, delay, 0x24c6_0001],
                            input,
                            &mut memory,
                            &[],
                        ));
                    }
                }
            }
        }
    }
    // New MUL paths: commit dirty destinations at failed memory guards,
    // preserve HI/LO, and retain the sole-store/debug-tracking contract.
    for rd in [0u32, 1, 2, 3, 5] {
        for address in [
            0x1000u32,
            0x8000_1001,
            0xa1ff_fffe,
            0x01ff_ffff,
            0x1000_2020,
        ] {
            let mut input = Registers::new(0x8000_1000);
            input.gpr.fill(0xdead_beef);
            input.gpr[1] = 2;
            input.gpr[2] = 3;
            input.gpr[4] = 3;
            input.gpr[5] = address;
            input.hi = 0x1234_5678;
            input.lo = 0x9abc_def0;
            let mul = (0x1c << 26) | (1 << 21) | (2 << 16) | (rd << 11) | 2;
            for opcode in [0x28u32, 0x29, 0x2b] {
                let store = (opcode << 26) | (5 << 21) | (3 << 16);
                memory_groups.push(memory_group(
                    format!("mul-short-store-{rd}-{opcode:x}-{address:x}"),
                    &[0x2463_0001, mul, store, 0],
                    input.clone(),
                    &mut memory,
                    &[],
                ));
                if !cfg!(debug_assertions) {
                    let words = [mul, store, 0x2421_0001, 0x2484_ffff, 0x1480_fffb, 0];
                    for budget in [6usize, 12, 15, 18] {
                        memory_groups.push(memory_group_budget(
                            format!("mul-loop-{rd}-{opcode:x}-{address:x}-{budget}"),
                            &words,
                            input.clone(),
                            &mut memory,
                            &[],
                            Some(budget),
                        ));
                    }
                }
            }
        }
    }
    if !cfg!(debug_assertions) {
        for opcode in [4u32, 5] {
            for base in [
                0,
                0x8000_0001,
                0xa000_0000,
                0x8000_0ff4,
                0x8000_1000,
                0x81ff_fffc,
                0x1000_0000,
            ] {
                for counter in [0, 1, 2, 7, u32::MAX] {
                    for budget in [0, 5, 6, 7, 11, 12, 17, 18, 30, 120] {
                        let mut regs = Registers::new(0x8000_1000);
                        regs.gpr.fill(0x12345678);
                        regs.gpr[0] = 0xdeadbeef;
                        regs.gpr[1] = base;
                        regs.gpr[9] = counter;
                        let words = [
                            0x8c280000,
                            0x25080001,
                            0xac280000,
                            0x2529ffff,
                            (opcode << 26) | (9 << 21) | 0xfffb,
                            0x24210004,
                        ];
                        memory_groups.push(memory_group_budget(
                            format!("self-loop-{opcode}-{base:x}-{counter}-{budget}"),
                            &words,
                            regs,
                            &mut memory,
                            &[],
                            Some(budget),
                        ));
                    }
                }
            }
        }
    }
    if !cfg!(debug_assertions) {
        for start in [0x80001000, 0x7ffffffc, 0xfffffffc] {
            for base in [0u32, 0x80000001, 0xa0001000, 0x81fffffc, 0x10000000] {
                for budget in [6usize, 12, 18, 60, u32::MAX as usize] {
                    let mut regs = Registers::new(start);
                    regs.gpr[1] = base;
                    regs.gpr[9] = 3;
                    // Store in the delay slot; the next iteration consumes the
                    // preceding iteration's value and updates the branch operand.
                    let words = [
                        0x8c280000, 0x25080001, 0x2529ffff, 0x00000000, 0x1520fffb, 0xac280000,
                    ];
                    memory_groups.push(memory_group_budget(
                        format!("self-loop-delay-{start:x}-{base:x}-{budget}"),
                        &words,
                        regs,
                        &mut memory,
                        &[],
                        Some(budget),
                    ));
                }
            }
        }
    }
    json!({"abi": 4, "registers": {"size": size_of::<Registers>(),
        "gpr": offset_of!(Registers, gpr), "pc": offset_of!(Registers, pc),
        "hi": offset_of!(Registers, hi), "lo": offset_of!(Registers, lo)},
        "groups": groups, "memoryGroups": memory_groups})
}

#[test]
fn ram_operations_are_supported_and_stores_end_the_prefix() {
    assert_eq!(size_of::<emitter::Context>(), 32);
    assert_eq!(offset_of!(emitter::Context, ram), 4);
    assert_eq!(offset_of!(emitter::Context, store_address), 8);
    assert_eq!(offset_of!(emitter::Context, store_size), 12);
    assert_eq!(offset_of!(emitter::Context, branch_delay), 16);
    assert_eq!(offset_of!(emitter::Context, branch_target), 20);
    assert_eq!(offset_of!(emitter::Context, branch_pending), 24);
    assert_eq!(offset_of!(emitter::Context, framebuffer), 28);
    assert_eq!(emitter::prefix_len(&[0x8c22_0000, 0, 0xac22_0000, 0]), 3);
    for opcode in [0x20, 0x21, 0x23, 0x24, 0x25, 0x28, 0x29, 0x2b] {
        assert_eq!(emitter::prefix_len(&[opcode << 26]), 1);
    }
}

#[test]
fn branch_pair_requires_supported_delay_and_stops_at_pair_or_store() {
    for branch in [0x1022_0001, 0x1422_ffff] {
        assert_eq!(emitter::prefix_len(&[branch]), 0);
        assert_eq!(emitter::prefix_len(&[0, branch]), 1);
        for delay in [0, 0x2421_0001, 0x8c22_0000, 0xac22_0000] {
            assert_eq!(emitter::prefix_len(&[0, 0, branch, delay, 0]), 4);
        }
        for delay in [branch, 0x0800_0400, 0x0022_001a, 0x0000_000c] {
            assert_eq!(emitter::prefix_len(&[0, 0, branch, delay, 0]), 2);
        }
        assert_eq!(emitter::prefix_len(&[0xac22_0000, branch, 0]), 1);
    }
}

#[test]
fn repeated_loop_requires_one_store_a_self_backedge_and_a_complete_delay() {
    let words = [
        0x8c280000, 0x25080001, 0xac280000, 0x2529ffff, 0x1520fffb, 0x24210004,
    ];
    assert_eq!(
        emitter::prefix_len(&words),
        if cfg!(debug_assertions) { 3 } else { 6 }
    );
    assert_eq!(emitter::prefix_len(&words[..5]), 3);
    for (index, replacement) in [
        (4, 0x1520fffa),
        (5, 0x08000400),
        (3, 0xac280004),
        (3, 0x0022001a), // DIV remains unsupported.
    ] {
        let mut rejected = words;
        rejected[index] = replacement;
        assert_eq!(emitter::prefix_len(&rejected), 3);
    }
}

#[test]
fn pending_delay_cannot_enter_a_compiled_prefix() {
    let mut engine = Engine::new();
    engine.session = 1;
    let mut cpu = Cpu::new(0x8000_1000);
    cpu.start();
    cpu.commit_wasm_jit_branch_state(1, 0x8000_2000, 1);
    let before = cpu_state(&cpu);
    let mut memory = Memory::new();
    let mut hint = CacheHint::default();
    assert!(matches!(
        engine.execute(cpu.regs.pc, &[0; 4], 4, &mut cpu, &mut memory, &mut hint),
        super::Execution::Fallback
    ));
    assert_eq!(cpu_state(&cpu), before);
    assert!(engine.slots.is_empty());
    cpu.step_fetched(0x2421_0001, &mut memory).unwrap();
    assert_eq!(cpu.wasm_jit_branch_state(), (0, 0x8000_2000, 1));
    assert_eq!(cpu.regs.pc, 0x8000_2000);
}

#[test]
fn unsupported_instructions_end_the_prefix() {
    for word in [
        0x8822_0000,
        0xb822_0000,
        0x5022_0001,
        0x0800_0400,
        0x0022_001a,
        0x0000_000c,
        0x0000_000d,
        0x0022_1820,
        0x0022_1822,
    ] {
        assert_eq!(emitter::prefix_len(&[word, 0x2401_0001]), 0, "{word:08x}");
        assert_eq!(emitter::prefix_len(&[0x2401_0001, word, 0]), 1);
    }
}

#[test]
fn generated_wasm_matches_the_interpreter() {
    let data = fixtures();
    let runner = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../scripts/tests/wasm-jit-differential.mjs");
    let fixture_path = std::env::var_os("DINGOO_WASM_JIT_FIXTURES")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::temp_dir().join(format!("dingoo-jit-{}.json", std::process::id()))
        });
    std::fs::write(&fixture_path, serde_json::to_vec(&data).unwrap()).unwrap();
    let output = Command::new(std::env::var_os("DINGOO_NODE").unwrap_or_else(|| "node".into()))
        .arg(runner)
        .arg(&fixture_path)
        .output()
        .expect("Node.js is required for Wasm differential tests");
    if std::env::var_os("DINGOO_WASM_JIT_FIXTURES").is_none() {
        let _ = std::fs::remove_file(fixture_path);
    }
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    eprintln!("{}", String::from_utf8_lossy(&output.stdout));
}

#[test]
fn fallback_metric_counts_enabled_dispatches_across_cache_clears() {
    let words = [0x2508_0001; 8];
    let mut engine = Engine::new();
    engine.session = 1;
    let mut cpu = Cpu::new(0x8000_1000);
    let mut memory = Memory::new();
    let mut hint = CacheHint::default();
    for _ in 0..2 {
        assert!(matches!(
            engine.execute(0x8000_1000, &words, 8, &mut cpu, &mut memory, &mut hint),
            super::Execution::Fallback
        ));
    }
    assert_eq!(engine.metric(5), 2.0);
    assert_eq!(engine.metric(7), 1.0);
    assert_eq!(engine.metric(8), 1.0);
    engine.execute(
        0x8000_2000,
        &[0xffff_ffff],
        1,
        &mut cpu,
        &mut memory,
        &mut hint,
    );
    assert_eq!(engine.metric(5), 3.0);
    assert_eq!(engine.metric(9), 1.0);
    engine.set_enabled(false);
    engine.execute(0x8000_1000, &words, 8, &mut cpu, &mut memory, &mut hint);
    assert_eq!(engine.metric(5), 3.0);
    engine.set_enabled(true);
    engine.execute(0x8000_1000, &words, 8, &mut cpu, &mut memory, &mut hint);
    assert_eq!(engine.metric(5), 4.0);
    engine.execute(0x8000_1000, &words, 0, &mut cpu, &mut memory, &mut hint);
    assert_eq!(engine.metric(5), 4.0);
}
