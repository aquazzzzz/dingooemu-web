//! MIPS32 -> Wasm emitter for straight-line integer and bounded RAM operations.
//! Stores terminate ordinary prefixes. Single-store self-loops may repeat
//! in release builds; all other BEQ/BNE pairs stop after their delay instruction.
use super::super::cpu::Registers;
use super::super::memory::{RAM_SIZE, FRAMEBUFFER_MAP_SIZE, LCD_FRAMEBUFFER_ALIASES};
use std::mem::offset_of;

pub(super) const EXIT_FALLTHROUGH: u64 = 1 << 32;
const EXIT_BUDGET: u64 = 2 << 32;
const EXIT_PC_MISMATCH: u64 = 3 << 32;
pub(super) const EXIT_MEMORY: u64 = 4 << 32;

/// ABI-v4 uses wasm32 addresses, independent of the native test host layout.
#[repr(C)]
pub(super) struct Context {
    pub registers: u32,
    pub ram: u32,
    pub store_address: u32,
    pub store_size: u32,
    pub branch_delay: u32,
    pub branch_target: u32,
    pub branch_pending: u32,
    pub framebuffer: u32,
}

pub(super) struct Module {
    pub bytes: Vec<u8>,
    /// Static prefix length, or instructions per iteration for a repeated loop.
    pub instructions: usize,
    pub branch: bool,
    pub repeated_loop: bool,
}

// Release-only: the ABI tracks one last store; debug builds retain per-store logs.
#[cold]
#[inline(never)]
fn self_loop_len(instructions: &[u32]) -> Option<usize> {
    if cfg!(debug_assertions) {
        return None;
    }
    let mut stores = 0;
    for (index, &word) in instructions.iter().enumerate() {
        if is_branch(word) {
            let delay = *instructions.get(index + 1)?;
            // BEQ/BNE with a backedge exactly to this prefix's entry.
            if word as i16 as i32 != -(index as i32 + 1) || !supported(delay) {
                return None;
            }
            stores += usize::from(is_store(delay));
            return (stores == 1 && index + 2 >= 4).then_some(index + 2);
        }
        if !supported(word) {
            return None;
        }
        stores += usize::from(is_store(word));
        if stores > 1 {
            return None;
        }
    }
    None
}

pub(super) fn prefix_len(instructions: &[u32]) -> usize {
    for (index, &word) in instructions.iter().enumerate() {
        if is_branch(word) {
            // Never pair across a truncated hook/slice fetch or unsupported delay.
            return if instructions
                .get(index + 1)
                .is_some_and(|&delay| supported(delay))
            {
                index + 2
            } else {
                index
            };
        }
        if !supported(word) {
            return index;
        }
        if is_store(word) {
            return self_loop_len(instructions).unwrap_or(index + 1);
        }
    }
    instructions.len()
}

fn is_branch(word: u32) -> bool {
    matches!(word >> 26, 0x04 | 0x05)
}

fn is_store(word: u32) -> bool {
    matches!(word >> 26, 0x28 | 0x29 | 0x2b)
}

fn supported(word: u32) -> bool {
    match word >> 26 {
        0 => matches!(
            word & 63,
            0x00 | 0x02
                | 0x03
                | 0x04
                | 0x06
                | 0x07
                | 0x21
                | 0x23
                | 0x24
                | 0x25
                | 0x26
                | 0x27
                | 0x2a
                | 0x2b
        ),
        0x1c => word & 63 == 0x02, // MUL writes Rd; HI/LO are unchanged.
        0x09 | 0x0a | 0x0b | 0x0c | 0x0d | 0x0e | 0x0f => true,
        0x20 | 0x21 | 0x23 | 0x24 | 0x25 | 0x28 | 0x29 | 0x2b => true,
        _ => false,
    }
}

fn unsigned(mut value: u32, out: &mut Vec<u8>) {
    loop {
        let byte = (value & 127) as u8;
        value >>= 7;
        out.push(byte | if value == 0 { 0 } else { 128 });
        if value == 0 {
            break;
        }
    }
}

fn signed(mut value: i64, out: &mut Vec<u8>) {
    loop {
        let byte = (value & 127) as u8;
        value >>= 7;
        let done = (value == 0 && byte & 64 == 0) || (value == -1 && byte & 64 != 0);
        out.push(byte | if done { 0 } else { 128 });
        if done {
            break;
        }
    }
}

fn string(value: &str, out: &mut Vec<u8>) {
    unsigned(value.len() as u32, out);
    out.extend_from_slice(value.as_bytes());
}

fn section(id: u8, data: &[u8], out: &mut Vec<u8>) {
    out.push(id);
    unsigned(data.len() as u32, out);
    out.extend_from_slice(data);
}

fn i32_const(value: u32, code: &mut Vec<u8>) {
    code.push(0x41);
    signed(value as i32 as i64, code);
}

#[derive(Default)]
struct RegisterCache {
    loaded: [bool; 32],
    dirty: u32,
}

// Parameters are 0/1, and dispatcher/address locals occupy 2..=5.
// R1..=R31 use locals 6..=36. R0 is always a literal zero.
const REGISTER_LOCAL_BASE: u8 = 5;

fn load_register(index: u32, cache: &mut RegisterCache, code: &mut Vec<u8>) {
    if index == 0 {
        i32_const(0, code);
        return;
    }
    let local = REGISTER_LOCAL_BASE + index as u8;
    if cache.loaded[index as usize] {
        code.extend_from_slice(&[0x20, local]);
    } else {
        code.extend_from_slice(&[0x20, 2, 0x28, 2]);
        unsigned(offset_of!(Registers, gpr) as u32 + index * 4, code);
        code.extend_from_slice(&[0x22, local]); // local.tee preserves the expression
        cache.loaded[index as usize] = true;
    }
}

fn write_register(index: u32, cache: &mut RegisterCache, code: &mut Vec<u8>) {
    debug_assert!(index != 0);
    code.extend_from_slice(&[0x21, REGISTER_LOCAL_BASE + index as u8]);
    cache.loaded[index as usize] = true;
    cache.dirty |= 1 << index;
}

fn store_offset(offset: u32, code: &mut Vec<u8>) {
    code.extend_from_slice(&[0x36, 2]);
    unsigned(offset, code);
}

fn exit_if(reason: u64, code: &mut Vec<u8>) {
    code.extend_from_slice(&[0x04, 0x40, 0x42]); // if; i64.const
    signed(reason as i64, code);
    code.extend_from_slice(&[0x0f, 0x0b]); // return; end
}

fn finish(
    start: u32,
    completed: usize,
    reason: u64,
    branch: bool,
    cache: &RegisterCache,
    repeated_loop: bool,
    code: &mut Vec<u8>,
) {
    if repeated_loop {
        code.extend_from_slice(&[0x20, 37]);
        i32_const(completed as u32, code);
        code.extend_from_slice(&[0x6a, 0x04, 0x40]);
    }
    if completed != 0 || repeated_loop {
        // This is also emitted inside failed memory guards. Only registers
        // written before that instruction belong to the committed prefix.
        for index in 1..32 {
            if cache.dirty & (1 << index) != 0 {
                code.extend_from_slice(&[0x20, 2, 0x20, REGISTER_LOCAL_BASE + index]);
                store_offset(offset_of!(Registers, gpr) as u32 + index as u32 * 4, code);
            }
        }
        code.extend_from_slice(&[0x20, 2]);
        i32_const(0, code);
        store_offset(offset_of!(Registers, gpr) as u32, code);
        code.extend_from_slice(&[0x20, 2]);
        if branch {
            code.extend_from_slice(&[0x20, 0, 0x28, 2, 16, 0x04, 0x7f]);
            code.extend_from_slice(&[0x20, 0, 0x28, 2, 20, 0x05]);
        }
        i32_const(start.wrapping_add(completed as u32 * 4), code);
        if branch {
            code.push(0x0b);
        }
        store_offset(offset_of!(Registers, pc) as u32, code);
        if branch {
            // A successful delay consumes the pending jump. Target/pending stay.
            code.extend_from_slice(&[0x20, 0]);
            i32_const(0, code);
            store_offset(16, code);
        }
    }
    if repeated_loop {
        code.push(0x0b);
    }
    code.push(0x42);
    signed((reason | completed as u64) as i64, code);
    if repeated_loop {
        // Low 32 bits are a dynamic instruction count; exit reason is unchanged.
        code.extend_from_slice(&[0x20, 37, 0xad, 0x7c]);
    }
}

fn memory_operation(
    start: u32,
    index: usize,
    word: u32,
    cache: &mut RegisterCache,
    count: usize,
    repeated_loop: bool,
    code: &mut Vec<u8>,
) {
    let opcode = word >> 26;
    let rt = (word >> 16) & 31;
    let width = match opcode {
        0x20 | 0x24 | 0x28 => 1,
        0x21 | 0x25 | 0x29 => 2,
        _ => 4,
    };
    load_register((word >> 21) & 31, cache, code);
    i32_const(word as i16 as i32 as u32, code);
    code.extend_from_slice(&[0x6a, 0x22, 4]); // wrapping address; local.tee address
    i32_const(0xc000_0000, code);
    code.push(0x71);
    i32_const(0x8000_0000, code);
    code.extend_from_slice(&[0x46, 0x04, 0x7f, 0x20, 4]); // if (result i32)
    i32_const(0x1fff_ffff, code);
    code.extend_from_slice(&[0x71, 0x05, 0x20, 4, 0x0b, 0x22, 5]);
    i32_const(RAM_SIZE - width, code);
    code.extend_from_slice(&[0x4d, 0x04, 0x40]); // RAM: physical <= last valid start
    if is_store(word) && repeated_loop {
        for (begin, end) in ram_code_spans(start, count) {
            overlap_guard(start, index, width, begin, end, cache, repeated_loop, code);
        }
    }
    code.extend_from_slice(&[0x20, 3, 0x20, 5, 0x6a, 0x21, 38, 0x05]);
    // Exactly the four guest aliases: clear bit 31 and bit 26 only. Using the
    // already translated physical address would incorrectly admit B4/B0 aliases.
    code.extend_from_slice(&[0x20, 4]);
    i32_const(0x7bff_ffff, code);
    code.push(0x71);
    i32_const(0x1000_0000, code);
    code.extend_from_slice(&[0x6b, 0x22, 5]);
    i32_const(FRAMEBUFFER_MAP_SIZE as u32 - width, code);
    code.extend_from_slice(&[0x4b, 0x04, 0x40]);
    finish(start, index, EXIT_MEMORY, false, cache, repeated_loop, code);
    code.extend_from_slice(&[0x0f, 0x0b]);
    if is_store(word) && repeated_loop {
        for (begin, end) in framebuffer_code_spans(start, count) {
            overlap_guard(start, index, width, begin, end, cache, repeated_loop, code);
        }
    }
    code.extend_from_slice(&[0x20, 0, 0x28, 2, 28, 0x20, 5, 0x6a, 0x21, 38]);
    // Framebuffer write logs use the guest address, RAM logs the physical one.
    code.extend_from_slice(&[0x20, 4, 0x21, 5, 0x0b]);

    if is_store(word) {
        code.extend_from_slice(&[0x20, 38]);
        load_register(rt, cache, code);
        code.extend_from_slice(&[
            match width {
                1 => 0x3a,
                2 => 0x3b,
                _ => 0x36,
            },
            0,
            0,
        ]);
        // Replay debug write tracking in Rust; release tracking is a no-op.
        code.extend_from_slice(&[0x20, 0, 0x20, 5]);
        store_offset(8, code);
        code.extend_from_slice(&[0x20, 0]);
        i32_const(width, code);
        store_offset(12, code);
    } else {
        code.extend_from_slice(&[0x20, 38]);
        code.extend_from_slice(&[
            match opcode {
                0x20 => 0x2c,
                0x24 => 0x2d,
                0x21 => 0x2e,
                0x25 => 0x2f,
                _ => 0x28,
            },
            0,
            0,
        ]);
        if rt == 0 {
            code.push(0x1a);
        } else {
            write_register(rt, cache, code);
        }
    }
}

fn overlap_guard(start: u32, index: usize, width: u32, begin: u32, end: u32,
    cache: &RegisterCache, repeated_loop: bool, code: &mut Vec<u8>) {
    code.extend_from_slice(&[0x20, 5]);
    i32_const(end, code);
    code.push(0x49);
    code.extend_from_slice(&[0x20, 5]);
    i32_const(width, code);
    code.push(0x6a);
    i32_const(begin, code);
    code.extend_from_slice(&[0x4b, 0x71, 0x04, 0x40]);
    finish(start, index, EXIT_MEMORY, false, cache, repeated_loop, code);
    code.extend_from_slice(&[0x0f, 0x0b]);
}

fn framebuffer_code_spans(start: u32, count: usize) -> Vec<(u32, u32)> {
    let mut spans: Vec<(u32, u32)> = Vec::new();
    for i in 0..count * 4 {
        let address = start.wrapping_add(i as u32);
        let Some(offset) = LCD_FRAMEBUFFER_ALIASES.iter().find_map(|base| {
            let offset = address.wrapping_sub(*base);
            (offset < FRAMEBUFFER_MAP_SIZE as u32).then_some(offset)
        }) else { continue };
        if let Some(last) = spans.last_mut().filter(|last| last.1 == offset) {
            last.1 += 1;
        } else {
            spans.push((offset, offset + 1));
        }
    }
    spans
}

fn ram_code_spans(start: u32, count: usize) -> Vec<(u32, u32)> {
    let mut spans: Vec<(u32, u32)> = Vec::new();
    for offset in 0..count * 4 {
        let address = start.wrapping_add(offset as u32);
        let physical = if (0x8000_0000..=0xbfff_ffff).contains(&address) {
            address & 0x1fff_ffff
        } else {
            address
        };
        if physical >= RAM_SIZE {
            continue;
        }
        if let Some(last) = spans.last_mut().filter(|last| last.1 == physical) {
            last.1 += 1;
        } else {
            spans.push((physical, physical + 1));
        }
    }
    spans
}

fn branch_operation(pc: u32, word: u32, cache: &mut RegisterCache, code: &mut Vec<u8>) {
    // Evaluate before the delay instruction can overwrite either operand.
    load_register((word >> 21) & 31, cache, code);
    load_register((word >> 16) & 31, cache, code);
    code.extend_from_slice(&[if word >> 26 == 4 { 0x46 } else { 0x47 }, 0x04, 0x40]);
    for (offset, value) in [
        (16, 1),
        (
            20,
            pc.wrapping_add(4)
                .wrapping_add((word as i16 as i32 as u32).wrapping_mul(4)),
        ),
        (24, 1),
    ] {
        code.extend_from_slice(&[0x20, 0]);
        i32_const(value, code);
        store_offset(offset, code);
    }
    code.push(0x0b);
}

pub(super) fn emit(start: u32, instructions: &[u32], shared: bool) -> Module {
    let count = prefix_len(instructions);
    let repeated_loop = self_loop_len(instructions).is_some();
    let branch = count >= 2 && is_branch(instructions[count - 2]);
    let mut code = vec![1, 37, 0x7f]; // dispatcher/address locals and cached GPRs
    let mut cache = RegisterCache::default();
    code.extend_from_slice(&[0x20, 0, 0x28, 2, 0, 0x21, 2]);
    code.extend_from_slice(&[0x20, 0, 0x28, 2, 4, 0x21, 3]);
    code.extend_from_slice(&[0x20, 1]);
    i32_const(count as u32, &mut code);
    code.push(0x49); // i32.lt_u: budget < block length
    exit_if(EXIT_BUDGET, &mut code);
    code.extend_from_slice(&[0x20, 2, 0x28, 2]);
    unsigned(offset_of!(Registers, pc) as u32, &mut code);
    i32_const(start, &mut code);
    code.push(0x47); // i32.ne
    exit_if(EXIT_PC_MISMATCH, &mut code);

    if repeated_loop {
        // A partial exit in a later iteration must also commit writes made
        // after that exit point in preceding iterations. Load every referenced
        // register once, and flush only the loop's possible destinations.
        let mut referenced = 0u32;
        let mut written = 0u32;
        for &word in &instructions[..count] {
            let opcode = word >> 26;
            let rs = (word >> 21) & 31;
            let rt = (word >> 16) & 31;
            referenced |= (1 << rs) | (1 << rt);
            if matches!(opcode, 0 | 0x1c) {
                let rd = (word >> 11) & 31;
                referenced |= 1 << rd;
                written |= 1 << rd;
            } else if !is_branch(word) && !is_store(word) {
                written |= 1 << rt;
            }
        }
        for register in 1..32 {
            if referenced & (1 << register) != 0 {
                load_register(register, &mut cache, &mut code);
                code.push(0x1a);
            }
        }
        cache.dirty = written & !1;
        code.extend_from_slice(&[0x03, 0x40]);
    }
    for (index, &word) in instructions[..count].iter().enumerate() {
        let rs = (word >> 21) & 31;
        let rt = (word >> 16) & 31;
        let rd = (word >> 11) & 31;
        let opcode = word >> 26;
        if is_branch(word) {
            branch_operation(
                start.wrapping_add(index as u32 * 4),
                word,
                &mut cache,
                &mut code,
            );
            continue;
        }
        if opcode >= 0x20 {
            memory_operation(
                start,
                index,
                word,
                &mut cache,
                count,
                repeated_loop,
                &mut code,
            );
            continue;
        }
        let destination = if matches!(opcode, 0 | 0x1c) { rd } else { rt };
        if destination == 0 {
            continue;
        }
        if opcode == 0 {
            let operation = word & 63;
            match operation {
                0x00 | 0x02 | 0x03 => {
                    load_register(rt, &mut cache, &mut code);
                    i32_const((word >> 6) & 31, &mut code);
                }
                0x04 | 0x06 | 0x07 => {
                    load_register(rt, &mut cache, &mut code);
                    load_register(rs, &mut cache, &mut code); // Wasm shifts mask to 5 bits
                }
                _ => {
                    load_register(rs, &mut cache, &mut code);
                    load_register(rt, &mut cache, &mut code);
                }
            }
            code.push(match operation {
                0x00 | 0x04 => 0x74,
                0x02 | 0x06 => 0x76,
                0x03 | 0x07 => 0x75,
                0x21 => 0x6a,
                0x23 => 0x6b,
                0x24 => 0x71,
                0x25 | 0x27 => 0x72,
                0x26 => 0x73,
                0x2a => 0x48,
                0x2b => 0x49,
                _ => unreachable!(),
            });
            if operation == 0x27 {
                i32_const(u32::MAX, &mut code);
                code.push(0x73);
            }
        } else if opcode == 0x1c {
            load_register(rs, &mut cache, &mut code);
            load_register(rt, &mut cache, &mut code);
            code.push(0x6c); // i32.mul keeps the low 32 bits, matching wrapping MUL.
        } else if opcode == 0x0f {
            i32_const((word & 65535) << 16, &mut code);
        } else {
            load_register(rs, &mut cache, &mut code);
            let immediate = if opcode <= 0x0b {
                word as i16 as i32 as u32
            } else {
                word & 65535
            };
            i32_const(immediate, &mut code);
            code.push(match opcode {
                0x09 => 0x6a,
                0x0a => 0x48,
                0x0b => 0x49,
                0x0c => 0x71,
                0x0d => 0x72,
                0x0e => 0x73,
                _ => unreachable!(),
            });
        }
        write_register(destination, &mut cache, &mut code);
    }
    if repeated_loop {
        // Subtract completed work before comparing, so a u32::MAX budget
        // cannot wrap the next-iteration threshold.
        code.extend_from_slice(&[0x20, 0, 0x28, 2, 16, 0x20, 1, 0x20, 37, 0x6b]);
        i32_const((count * 2) as u32, &mut code);
        code.extend_from_slice(&[0x4f, 0x71, 0x04, 0x40]);
        code.extend_from_slice(&[0x20, 37]);
        i32_const(count as u32, &mut code);
        code.extend_from_slice(&[0x6a, 0x21, 37, 0x20, 0]);
        i32_const(0, &mut code);
        store_offset(16, &mut code);
        code.extend_from_slice(&[0x0c, 1, 0x0b, 0x0b]);
    }
    finish(
        start,
        count,
        EXIT_FALLTHROUGH,
        branch,
        &cache,
        repeated_loop,
        &mut code,
    );
    code.push(0x0b);

    let mut bytes = b"\0asm\x01\0\0\0".to_vec();
    section(1, &[1, 0x60, 2, 0x7f, 0x7f, 1, 0x7e], &mut bytes);
    let mut imports = vec![1];
    string("env", &mut imports);
    string("memory", &mut imports);
    imports.push(2); // memory import
    imports.push(if shared { 3 } else { 1 });
    unsigned(0, &mut imports);
    unsigned(32768, &mut imports); // build contract: maximum memory = 2 GiB
    section(2, &imports, &mut bytes);
    section(3, &[1, 0], &mut bytes);
    let mut exports = vec![1];
    string("block", &mut exports);
    exports.extend_from_slice(&[0, 0]);
    section(7, &exports, &mut bytes);
    let mut bodies = vec![1];
    unsigned(code.len() as u32, &mut bodies);
    bodies.extend(code);
    section(10, &bodies, &mut bytes);
    Module {
        bytes,
        instructions: count,
        branch,
        repeated_loop,
    }
}
