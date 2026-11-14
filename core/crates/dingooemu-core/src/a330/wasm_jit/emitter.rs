//! ARM integer blocks compiled to Wasm. No guest calls or MMIO are imported.
//! Every exit commits the exact completed prefix; unsupported accesses retry in
//! the interpreter. Stores cannot touch the program image or device registers.
use crate::a330::cpu::{ArmInstructionKind as Kind, DecodedArmInstruction};
use crate::a330::memory::*;

#[repr(C)]
pub(super) struct Context {
    pub registers: u32,
    pub cpsr: u32,
    pub ram: u32,
    pub stack: u32,
    pub heap: u32,
    pub framebuffer: u32,
    pub heap_base: u32,
    pub program_start: u32,
    pub program_end: u32,
    pub homebrew: u32,
}

const FLAGS: u32 = 18;
const REGS: u32 = 19;
const FLAG_PTR: u32 = 20;
const LEFT: u32 = 21;
const RIGHT: u32 = 22;
const RESULT: u32 = 23;
const CARRY: u32 = 24;
const OVERFLOW: u32 = 25;
const ADDRESS: u32 = 26;
const HOST: u32 = 27;
const ADJUSTED: u32 = 28;
const AMOUNT: u32 = 29;
const OFFSET: u32 = 30;
const WIDE: u32 = 31;
const SIGNED: u32 = 32;

pub(super) fn prefix_len(words: &[DecodedArmInstruction]) -> usize {
    for (i, word) in words.iter().enumerate() {
        if !supported(*word) {
            return i;
        }
        if word.kind == Kind::Branch {
            return i + 1;
        }
    }
    words.len()
}

fn supported(d: DecodedArmInstruction) -> bool {
    let w = d.instruction;
    if w >> 28 == 15 {
        return false;
    }
    match d.kind {
        Kind::DataProcessing => (w >> 12) & 15 != 15,
        Kind::CountLeadingZeros => (w >> 12) & 15 != 15,
        Kind::Multiply => [w >> 16, w >> 12, w >> 8, w].iter().all(|r| r & 15 != 15),
        Kind::LongMultiply => {
            [w >> 16, w >> 12, w >> 8, w].iter().all(|r| r & 15 != 15)
                && (w >> 16) & 15 != (w >> 12) & 15
        }
        Kind::SingleTransfer => (w >> 12) & 15 != 15,
        Kind::HalfTransfer => {
            (w >> 12) & 15 != 15 && (w >> 5) & 3 != 0 && (w & (1 << 20) != 0 || (w >> 5) & 3 == 1)
        }
        Kind::Branch => true,
        _ => false,
    }
}

fn leb(mut x: u32, b: &mut Vec<u8>) {
    loop {
        let y = (x & 127) as u8;
        x >>= 7;
        b.push(y | if x == 0 { 0 } else { 128 });
        if x == 0 {
            break;
        }
    }
}
fn sleb(mut x: i64, b: &mut Vec<u8>) {
    loop {
        let y = (x & 127) as u8;
        x >>= 7;
        let done = (x == 0 && y & 64 == 0) || (x == -1 && y & 64 != 0);
        b.push(y | if done { 0 } else { 128 });
        if done {
            break;
        }
    }
}
fn section(id: u8, bytes: &[u8], out: &mut Vec<u8>) {
    out.push(id);
    leb(bytes.len() as u32, out);
    out.extend(bytes);
}

#[derive(Default)]
struct Code {
    b: Vec<u8>,
    read: u32,
    dirty: u32,
}
impl Code {
    fn op(&mut self, op: u8) {
        self.b.push(op);
    }
    fn get(&mut self, n: u32) {
        self.op(0x20);
        leb(if n >= 2 { n + 2 } else { n }, &mut self.b);
    }
    fn set(&mut self, n: u32) {
        self.op(0x21);
        leb(if n >= 2 { n + 2 } else { n }, &mut self.b);
    }
    fn k(&mut self, n: u32) {
        self.op(0x41);
        sleb(n as i32 as i64, &mut self.b);
    }
    fn k64(&mut self, n: i64) {
        self.op(0x42);
        sleb(n, &mut self.b);
    }
    fn mem(&mut self, op: u8, offset: u32) {
        self.op(op);
        self.op(0);
        leb(offset, &mut self.b);
    }
    fn ctx(&mut self, offset: u32) {
        self.get(0);
        self.mem(0x28, offset);
    }
    fn if_(&mut self) {
        self.b.extend([0x04, 0x40]);
    }
    fn else_(&mut self) {
        self.op(0x05);
    }
    fn end(&mut self) {
        self.op(0x0b);
    }
    fn reg(&mut self, n: u32, pc: u32) {
        if n == 15 {
            self.k(pc.wrapping_add(8));
        } else {
            self.read |= 1 << n;
            self.get(n + 2);
        }
    }
    fn write(&mut self, n: u32) {
        self.read |= 1 << n;
        self.dirty |= 1 << n;
        self.set(n + 2);
    }
    fn flag(&mut self, bit: u32) {
        self.get(FLAGS);
        self.k(bit);
        self.op(0x76);
        self.k(1);
        self.op(0x71);
    }
    fn condition(&mut self, cond: u32) {
        match cond {
            0 | 1 => self.flag(30),
            2 | 3 => self.flag(29),
            4 | 5 => self.flag(31),
            6 | 7 => self.flag(28),
            8 | 9 => {
                self.flag(29);
                self.flag(30);
                self.op(0x45);
                self.op(0x71);
            }
            10..=13 => {
                self.flag(31);
                self.flag(28);
                self.op(0x46);
                if cond >= 12 {
                    self.flag(30);
                    self.op(0x45);
                    self.op(0x71);
                }
            }
            _ => self.k(1),
        }
        if cond < 14 && cond & 1 != 0 {
            self.op(0x45);
        }
    }
    fn finish(&mut self, pc: Option<u32>, count: usize, reason: u32) {
        for r in 0..15 {
            if self.dirty & (1 << r) != 0 {
                self.get(REGS);
                self.get(r + 2);
                self.mem(0x36, r * 4);
            }
        }
        self.get(REGS);
        if let Some(pc) = pc {
            self.k(pc);
        } else {
            self.get(17);
        }
        self.mem(0x36, 60);
        self.get(FLAG_PTR);
        self.get(FLAGS);
        self.mem(0x36, 0);
        self.k64(((reason as u64) << 32 | count as u64) as i64);
        self.op(0x0f);
    }
    fn nz(&mut self, arithmetic: bool, logical: bool) {
        self.get(FLAGS);
        self.k(if arithmetic {
            0x0fff_ffff
        } else if logical {
            0x1fff_ffff
        } else {
            0x3fff_ffff
        });
        self.op(0x71);
        self.get(RESULT);
        self.k(0x8000_0000);
        self.op(0x71);
        self.op(0x72);
        self.get(RESULT);
        self.op(0x45);
        self.k(30);
        self.op(0x74);
        self.op(0x72);
        if arithmetic || logical {
            self.get(CARRY);
            self.k(29);
            self.op(0x74);
            self.op(0x72);
        }
        if arithmetic {
            self.get(OVERFLOW);
            self.k(28);
            self.op(0x74);
            self.op(0x72);
        }
        self.set(FLAGS);
    }
    // RIGHT and AMOUNT are inputs, RIGHT and CARRY are outputs.
    fn shift(&mut self, kind: u32, immediate: bool) {
        self.flag(29);
        self.set(CARRY);
        if immediate && (kind == 1 || kind == 2) {
            self.get(AMOUNT);
            self.op(0x45);
            self.if_();
            self.k(32);
            self.set(AMOUNT);
            self.end();
        }
        if immediate && kind == 3 {
            self.get(AMOUNT);
            self.op(0x45);
            self.if_();
            self.get(RIGHT);
            self.k(1);
            self.op(0x71);
            self.set(OVERFLOW);
            self.get(CARRY);
            self.k(31);
            self.op(0x74);
            self.get(RIGHT);
            self.k(1);
            self.op(0x76);
            self.op(0x72);
            self.set(RIGHT);
            self.get(OVERFLOW);
            self.set(CARRY);
            self.else_();
        }
        self.get(AMOUNT);
        self.if_();
        if kind == 3 {
            self.get(RIGHT);
            self.get(AMOUNT);
            self.op(0x78);
            self.set(RIGHT);
            self.get(RIGHT);
            self.k(31);
            self.op(0x76);
            self.set(CARRY);
        } else {
            self.get(AMOUNT);
            self.k(32);
            self.op(0x49);
            self.if_();
            self.get(RIGHT);
            if kind == 0 {
                self.k(32);
                self.get(AMOUNT);
                self.op(0x6b);
            } else {
                self.get(AMOUNT);
                self.k(1);
                self.op(0x6b);
            }
            self.op(0x76);
            self.k(1);
            self.op(0x71);
            self.set(CARRY);
            self.get(RIGHT);
            self.get(AMOUNT);
            self.op(match kind {
                0 => 0x74,
                1 => 0x76,
                _ => 0x75,
            });
            self.set(RIGHT);
            self.else_();
            if kind == 2 {
                self.get(RIGHT);
                self.k(31);
                self.op(0x76);
                self.set(CARRY);
                self.get(RIGHT);
                self.k(31);
                self.op(0x75);
                self.set(RIGHT);
            } else {
                self.get(AMOUNT);
                self.k(32);
                self.op(0x46);
                self.get(RIGHT);
                if kind == 0 {
                    self.k(1);
                    self.op(0x71);
                } else {
                    self.k(31);
                    self.op(0x76);
                }
                self.op(0x71);
                self.set(CARRY);
                self.k(0);
                self.set(RIGHT);
            }
            self.end();
        }
        self.end();
        if immediate && kind == 3 {
            self.end();
        }
    }
    fn operand(&mut self, w: u32, pc: u32) {
        if w & (1 << 25) != 0 {
            let rot = ((w >> 8) & 15) * 2;
            let value = (w & 255).rotate_right(rot);
            self.k(value);
            self.set(RIGHT);
            if rot == 0 {
                self.flag(29);
            } else {
                self.k(value >> 31);
            }
            self.set(CARRY);
        } else {
            self.reg(w & 15, pc);
            self.set(RIGHT);
            if w & 16 != 0 {
                self.reg((w >> 8) & 15, pc);
                self.k(255);
                self.op(0x71);
            } else {
                self.k((w >> 7) & 31);
            }
            self.set(AMOUNT);
            self.shift((w >> 5) & 3, w & 16 == 0);
        }
    }
    fn data(&mut self, w: u32, pc: u32) {
        let op = (w >> 21) & 15;
        let rd = (w >> 12) & 15;
        self.reg((w >> 16) & 15, pc);
        self.set(LEFT);
        self.operand(w, pc);
        let arithmetic = matches!(op, 2..=7 | 10 | 11);
        if arithmetic {
            if matches!(op, 3 | 7) {
                self.get(LEFT);
                self.get(RIGHT);
                self.set(LEFT);
                self.set(RIGHT);
            }
            if matches!(op, 2 | 3 | 6 | 7 | 10) {
                self.get(RIGHT);
                self.k(u32::MAX);
                self.op(0x73);
                self.set(RIGHT);
            }
            if matches!(op, 5..=7) {
                self.flag(29);
            } else {
                self.k(u32::from(matches!(op, 2 | 3 | 10)));
            }
            self.set(CARRY);
            self.get(LEFT);
            self.op(0xad);
            self.get(RIGHT);
            self.op(0xad);
            self.op(0x7c);
            self.get(CARRY);
            self.op(0xad);
            self.op(0x7c);
            self.set(WIDE);
            self.get(LEFT);
            self.op(0xac);
            self.get(RIGHT);
            self.op(0xac);
            self.op(0x7c);
            self.get(CARRY);
            self.op(0xad);
            self.op(0x7c);
            self.set(SIGNED);
            self.get(WIDE);
            self.op(0xa7);
            self.set(RESULT);
            self.get(WIDE);
            self.k64(32);
            self.op(0x88);
            self.op(0xa7);
            self.set(CARRY);
            self.get(SIGNED);
            self.get(RESULT);
            self.op(0xac);
            self.op(0x52);
            self.set(OVERFLOW);
        } else {
            match op {
                0 | 8 => {
                    self.get(LEFT);
                    self.get(RIGHT);
                    self.op(0x71);
                }
                1 | 9 => {
                    self.get(LEFT);
                    self.get(RIGHT);
                    self.op(0x73);
                }
                12 => {
                    self.get(LEFT);
                    self.get(RIGHT);
                    self.op(0x72);
                }
                13 => self.get(RIGHT),
                14 => {
                    self.get(LEFT);
                    self.get(RIGHT);
                    self.k(u32::MAX);
                    self.op(0x73);
                    self.op(0x71);
                }
                15 => {
                    self.get(RIGHT);
                    self.k(u32::MAX);
                    self.op(0x73);
                }
                _ => unreachable!(),
            }
            self.set(RESULT);
        }
        if !matches!(op, 8..=11) {
            self.get(RESULT);
            self.write(rd);
        }
        if w & (1 << 20) != 0 || matches!(op, 8..=11) {
            self.nz(arithmetic, !arithmetic);
        }
    }
    fn memory(&mut self, w: u32, pc: u32, index: usize, half: bool) {
        let rn = (w >> 16) & 15;
        let rd = (w >> 12) & 15;
        let load = w & (1 << 20) != 0;
        let kind = (w >> 5) & 3;
        let width = if half {
            if kind == 2 {
                1
            } else {
                2
            }
        } else if w & (1 << 22) != 0 {
            1
        } else {
            4
        };
        self.reg(rn, pc);
        self.set(LEFT);
        if half {
            if w & (1 << 22) != 0 {
                self.k(((w >> 4) & 0xf0) | (w & 15));
            } else {
                self.reg(w & 15, pc);
            }
            self.set(RIGHT);
        } else if w & (1 << 25) == 0 {
            self.k(w & 0xfff);
            self.set(RIGHT);
        } else {
            self.reg(w & 15, pc);
            self.set(RIGHT);
            self.k((w >> 7) & 31);
            self.set(AMOUNT);
            self.shift((w >> 5) & 3, true);
        }
        self.get(LEFT);
        self.get(RIGHT);
        self.op(if w & (1 << 23) != 0 { 0x6a } else { 0x6b });
        self.set(ADJUSTED);
        self.get(if w & (1 << 24) != 0 { ADJUSTED } else { LEFT });
        self.set(ADDRESS);
        // Retail word loads rotate the aligned word. Homebrew loads packed words.
        if load && width == 4 {
            self.ctx(36);
            self.op(0x45);
            self.if_();
            self.get(ADDRESS);
            self.k(!3);
            self.op(0x71);
            self.set(ADDRESS);
            self.end();
        }
        self.k(0);
        self.set(HOST);
        for (base, size, ptr) in [
            (SYSTEM_RAM_BASE, SYSTEM_RAM_SIZE, 8),
            (STACK_BASE, STACK_SIZE, 12),
            (0, HEAP_SIZE, 16),
            (FRAMEBUFFER_BASE, FRAMEBUFFER_SIZE, 20),
        ] {
            self.get(ADDRESS);
            if ptr == 16 {
                self.ctx(24);
            } else {
                self.k(base);
            }
            self.op(0x6b);
            self.set(OFFSET);
            self.get(OFFSET);
            self.k(size as u32 - width);
            self.op(0x4d);
            self.if_();
            self.ctx(ptr);
            self.get(OFFSET);
            self.op(0x6a);
            self.set(HOST);
            self.end();
        }
        // The homebrew heap overlaps system MMIO, which always needs the bus.
        self.get(ADDRESS);
        self.k(LEGACY_SYSTEM_MMIO_BASE + LEGACY_SYSTEM_MMIO_SIZE as u32);
        self.op(0x49);
        self.get(ADDRESS);
        self.k(width);
        self.op(0x6a);
        self.k(LEGACY_SYSTEM_MMIO_BASE);
        self.op(0x4b);
        self.op(0x71);
        self.if_();
        self.k(0);
        self.set(HOST);
        self.end();
        if !load {
            self.get(ADDRESS);
            self.ctx(32);
            self.op(0x49);
            self.get(ADDRESS);
            self.k(width);
            self.op(0x6a);
            self.ctx(28);
            self.op(0x4b);
            self.op(0x71);
            self.if_();
            self.k(0);
            self.set(HOST);
            self.end();
        }
        self.get(HOST);
        self.op(0x45);
        self.if_();
        self.finish(Some(pc), index, 1);
        self.end();
        self.get(HOST);
        if load {
            self.mem(
                if half && kind == 2 {
                    0x2c
                } else if half && kind == 3 {
                    0x2e
                } else {
                    match width {
                        1 => 0x2d,
                        2 => 0x2f,
                        _ => 0x28,
                    }
                },
                0,
            );
            self.set(RESULT);
            if width == 4 {
                self.ctx(36);
                self.op(0x45);
                self.if_();
                self.get(RESULT);
                self.get(if w & (1 << 24) != 0 { ADJUSTED } else { LEFT });
                self.k(3);
                self.op(0x71);
                self.k(3);
                self.op(0x74);
                self.op(0x78);
                self.set(RESULT);
                self.end();
            }
            self.get(RESULT);
            self.write(rd);
        } else {
            self.reg(rd, pc);
            self.mem(
                match width {
                    1 => 0x3a,
                    2 => 0x3b,
                    _ => 0x36,
                },
                0,
            );
        }
        if (w & (1 << 24) == 0 || w & (1 << 21) != 0) && rn != 15 {
            self.get(ADJUSTED);
            self.write(rn);
        }
    }
}

pub(super) fn emit(start: u32, words: &[DecodedArmInstruction], shared: bool) -> Vec<u8> {
    let count = prefix_len(words);
    let mut c = Code::default();
    c.k(start.wrapping_add(count as u32 * 4));
    c.set(17);
    for (index, d) in words[..count].iter().enumerate() {
        let w = d.instruction;
        let pc = start.wrapping_add(index as u32 * 4);
        let cond = w >> 28;
        if cond != 14 {
            c.condition(cond);
            c.if_();
        }
        match d.kind {
            Kind::DataProcessing => c.data(w, pc),
            Kind::SingleTransfer => c.memory(w, pc, index, false),
            Kind::HalfTransfer => c.memory(w, pc, index, true),
            Kind::CountLeadingZeros => {
                c.reg(w & 15, pc);
                c.op(0x67);
                c.write((w >> 12) & 15);
            }
            Kind::Multiply | Kind::LongMultiply => {
                let long = d.kind == Kind::LongMultiply;
                let signed = long && w & (1 << 22) != 0;
                c.reg(w & 15, pc);
                if long {
                    c.op(if signed { 0xac } else { 0xad });
                }
                c.reg((w >> 8) & 15, pc);
                if long {
                    c.op(if signed { 0xac } else { 0xad });
                }
                c.op(if long { 0x7e } else { 0x6c });
                if w & (1 << 21) != 0 {
                    if long {
                        c.reg((w >> 16) & 15, pc);
                        c.op(0xad);
                        c.k64(32);
                        c.op(0x86);
                        c.reg((w >> 12) & 15, pc);
                        c.op(0xad);
                        c.op(0x84);
                    } else {
                        c.reg((w >> 12) & 15, pc);
                    }
                    c.op(if long { 0x7c } else { 0x6a });
                }
                if long {
                    c.set(WIDE);
                    c.get(WIDE);
                    c.op(0xa7);
                    c.write((w >> 12) & 15);
                    c.get(WIDE);
                    c.k64(32);
                    c.op(0x88);
                    c.op(0xa7);
                    c.write((w >> 16) & 15);
                    if w & (1 << 20) != 0 {
                        c.get(FLAGS);
                        c.k(0x3fff_ffff);
                        c.op(0x71);
                        c.get(WIDE);
                        c.k64(32);
                        c.op(0x88);
                        c.op(0xa7);
                        c.k(0x8000_0000);
                        c.op(0x71);
                        c.op(0x72);
                        c.get(WIDE);
                        c.op(0x50);
                        c.k(30);
                        c.op(0x74);
                        c.op(0x72);
                        c.set(FLAGS);
                    }
                } else {
                    c.set(RESULT);
                    c.get(RESULT);
                    c.write((w >> 16) & 15);
                    if w & (1 << 20) != 0 {
                        c.nz(false, false);
                    }
                }
            }
            Kind::Branch => {
                if w & (1 << 24) != 0 {
                    c.k(pc.wrapping_add(4));
                    c.write(14);
                }
                let offset = (((w & 0xffffff) << 8) as i32 >> 6) as u32;
                c.k(pc.wrapping_add(8).wrapping_add(offset));
                c.set(17);
            }
            _ => unreachable!(),
        }
        if cond != 14 {
            c.end();
        }
    }
    c.finish(None, count, 0);
    let mut p = Code::default();
    p.b.extend([0x20, 2]); // Current register pointer argument.
    p.set(REGS);
    p.b.extend([0x20, 3]); // Current CPSR pointer argument.
    p.set(FLAG_PTR);
    p.get(FLAG_PTR);
    p.mem(0x28, 0);
    p.set(FLAGS);
    // A wrong entry or insufficient budget leaves every guest byte unchanged.
    p.get(1);
    p.k(count as u32);
    p.op(0x49);
    p.get(REGS);
    p.mem(0x28, 60);
    p.k(start);
    p.op(0x47);
    p.op(0x72);
    p.if_();
    p.k64(2i64 << 32);
    p.op(0x0f);
    p.end();
    for r in 0..15 {
        if c.read & (1 << r) != 0 {
            p.get(REGS);
            p.mem(0x28, r * 4);
            p.set(r + 2);
        }
    }
    let mut body = vec![2, 29, 0x7f, 2, 0x7e];
    body.extend(p.b);
    body.extend(c.b);
    body.push(0x0b);
    let mut out = b"\0asm\x01\0\0\0".to_vec();
    section(1, &[1, 0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7e], &mut out);
    let mut imports = vec![
        1,
        3,
        b'e',
        b'n',
        b'v',
        6,
        b'm',
        b'e',
        b'm',
        b'o',
        b'r',
        b'y',
        2,
        if shared { 3 } else { 1 },
        0,
    ];
    leb(32768, &mut imports);
    section(2, &imports, &mut out);
    section(3, &[1, 0], &mut out);
    section(7, &[1, 5, b'b', b'l', b'o', b'c', b'k', 0, 0], &mut out);
    let mut functions = vec![1];
    leb(body.len() as u32, &mut functions);
    functions.extend(body);
    section(10, &functions, &mut out);
    out
}
