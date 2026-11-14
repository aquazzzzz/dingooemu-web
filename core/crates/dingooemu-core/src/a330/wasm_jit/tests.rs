use super::emitter;
use crate::a330::cpu::{Bus, Cpu, DecodedArmInstruction};
use crate::error::Result;
use serde_json::{json, Value};
use std::{collections::BTreeMap, process::Command};

const START: u32 = 0x1010_0000;
const REGIONS: [u32; 4] = [0x1000_0000, 0x1ff0_0000, 0x2100_0000, 0x8000_0000];
struct Oracle {
    bytes: BTreeMap<u32, u8>,
    packed: bool,
}
impl Oracle {
    fn new(packed: bool) -> Self {
        let mut bytes = BTreeMap::new();
        for base in REGIONS {
            for i in 0..256 {
                bytes.insert(base + i, (i * 37 + 19) as u8);
            }
        }
        Self { bytes, packed }
    }
    fn dump(&self) -> Vec<u8> {
        REGIONS
            .into_iter()
            .flat_map(|base| (0..256).map(move |i| *self.bytes.get(&(base + i)).unwrap()))
            .collect()
    }
}
impl Bus for Oracle {
    fn read8(&mut self, a: u32) -> Result<u8> {
        Ok(*self.bytes.get(&a).unwrap_or(&0))
    }
    fn read16(&mut self, a: u32) -> Result<u16> {
        Ok(u16::from_le_bytes([self.read8(a)?, self.read8(a + 1)?]))
    }
    fn read32(&mut self, a: u32) -> Result<u32> {
        Ok(u32::from_le_bytes([
            self.read8(a)?,
            self.read8(a + 1)?,
            self.read8(a + 2)?,
            self.read8(a + 3)?,
        ]))
    }
    fn load_word(&mut self, a: u32) -> Result<u32> {
        if self.packed {
            self.read32(a)
        } else {
            Ok(self.read32(a & !3)?.rotate_right((a & 3) * 8))
        }
    }
    fn write8(&mut self, a: u32, v: u8) -> Result<()> {
        self.bytes.insert(a, v);
        Ok(())
    }
    fn write16(&mut self, a: u32, v: u16) -> Result<()> {
        for (i, b) in v.to_le_bytes().into_iter().enumerate() {
            self.write8(a + i as u32, b)?;
        }
        Ok(())
    }
    fn write32(&mut self, a: u32, v: u32) -> Result<()> {
        for (i, b) in v.to_le_bytes().into_iter().enumerate() {
            self.write8(a + i as u32, b)?;
        }
        Ok(())
    }
    fn svc(&mut self, _: &mut Cpu, _: u32) -> Result<()> {
        panic!("unexpected SVC")
    }
}
fn case(
    words: &[u32],
    regs: [u32; 16],
    flags: u32,
    completed: usize,
    budget: usize,
    packed: bool,
) -> Value {
    let mut cpu = Cpu::new(START, 0, 0);
    cpu.r = regs;
    cpu.cpsr = flags;
    cpu.start();
    let mut bus = Oracle::new(packed);
    for word in &words[..completed] {
        cpu.step_fetched_arm(DecodedArmInstruction::decode(*word), &mut bus)
            .unwrap();
    }
    json!({"regs":regs,"flags":flags,"steps":completed,"budget":budget,"packed":packed,"expectedRegs":cpu.r,"expectedFlags":cpu.cpsr,"memory":bus.dump()})
}
fn group(words: &[u32], cases: Vec<Value>) -> Value {
    let decoded: Vec<_> = words
        .iter()
        .map(|w| DecodedArmInstruction::decode(*w))
        .collect();
    assert_eq!(emitter::prefix_len(&decoded), words.len(), "{words:x?}");
    json!({"words":words,"module":emitter::emit(START,&decoded,false),"sharedModule":emitter::emit(START,&decoded,true),"cases":cases})
}
#[test]
fn generated_arm_matches_interpreter() {
    let values = [
        0,
        1,
        2,
        31,
        32,
        33,
        63,
        64,
        255,
        256,
        0x7fff_ffff,
        0x8000_0000,
        0xffff_ffff,
    ];
    let mut groups = Vec::new();
    let mut seed = 0x98badcfeu32;
    let mut random = || {
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        seed
    };
    for op in 0..16 {
        for condition in 0..15 {
            for variant in 0..6 {
                let operand = match variant {
                    0 => 0x0200_04ab,
                    1 => 1,
                    2 => 0x311,
                    3 => 0x331,
                    4 => 0x351,
                    _ => 0x371,
                };
                let w = (condition << 28) | (op << 21) | (1 << 20) | (2 << 12) | operand;
                let mut cases = Vec::new();
                for &value in &values {
                    let mut regs = [0; 16];
                    for r in &mut regs {
                        *r = random();
                    }
                    regs[15] = START;
                    regs[3] = value;
                    regs[0] = values[(random() as usize) % values.len()];
                    regs[1] = values[(random() as usize) % values.len()];
                    cases.push(case(&[w], regs, random() & !32, 1, 1, false));
                }
                groups.push(group(&[w], cases));
            }
        }
    }
    // Immediate shifter zero/32/RRX, no-S operations and register aliases.
    for kind in 0..4 {
        for amount in [0, 1, 31] {
            for op in 0..16 {
                if (8..=11).contains(&op) {
                    continue;
                }
                let w = 0xe000_0000 | (op << 21) | (kind << 5) | (amount << 7) | 1;
                let cases = values
                    .iter()
                    .map(|v| {
                        let mut r = [*v; 16];
                        r[15] = START;
                        case(&[w], r, random() & !32, 1, 1, false)
                    })
                    .collect();
                groups.push(group(&[w], cases));
            }
        }
    }
    for w in [
        0xe012_0391,
        0xe032_0391,
        0xe093_2491,
        0xe0b3_2491,
        0xe0d3_2491,
        0xe0f3_2491,
        0xe16f_2f11,
        0xe08f_2001,
        0xe1a0_031f,
        0xe1a0_0f11,
    ] {
        let cases = (0..64)
            .map(|_| {
                let mut r = [0; 16];
                for x in &mut r {
                    *x = random();
                }
                r[15] = START;
                case(&[w], r, random() & !32, 1, 1, false)
            })
            .collect();
        groups.push(group(&[w], cases));
    }
    for cond in 0..15 {
        for link in [0, 1] {
            for displacement in [0, 0xff_fffd] {
                let w = (cond << 28) | 0x0a00_0000 | (link << 24) | displacement;
                let cases = (0..16)
                    .map(|f| {
                        let mut r = [0; 16];
                        r[15] = START;
                        case(&[w], r, f << 28, 1, 1, false)
                    })
                    .collect();
                groups.push(group(&[w], cases));
            }
        }
    }
    for w in [
        0xe590_2000,
        0xe5d0_2000,
        0xe580_2000,
        0xe5c0_2000,
        0xe1d0_20b0,
        0xe1d0_20d0,
        0xe1d0_20f0,
        0xe1c0_20b0,
        0xe490_2004,
        0xe530_2004,
        0xe790_2081,
        0xe590_0004,
        0xe490_0004,
        0xe580_f000,
    ] {
        // PC stores stay in the interpreter for now.
        if w == 0xe580_f000 {
            continue;
        }
        let mut cases = Vec::new();
        for base in REGIONS {
            for offset in [32, 33, 34, 35] {
                for packed in [false, true] {
                    let mut r = [0; 16];
                    r[0] = base + offset;
                    r[1] = 1;
                    r[2] = 0x89abcdef;
                    r[15] = START;
                    cases.push(case(&[w], r, 0xa0000000, 1, 1, packed));
                }
            }
        }
        groups.push(group(&[w], cases));
    }
    // Failure after successful arithmetic must commit only the completed prefix.
    let words = [0xe290_0001, 0xe582_1000, 0xe283_3001];
    let mut cases = Vec::new();
    for a in [
        0x1010_0000,
        0x0930_201c,
        0xffff_ffff,
        0x2000_0000,
        0x1fff_ffff,
    ] {
        let mut r = [0; 16];
        r[2] = a;
        r[15] = START;
        cases.push(case(&words, r, 0, 1, 3, false));
    }
    let mut r = [7; 16];
    r[15] = START;
    cases.push(case(&words, r, 0xf0000000, 0, 2, false));
    groups.push(group(&words, cases));
    // Conditional memory writes and flag updates, including false conditions.
    let words = [0xe350_0000, 0x0582_1000, 0x1281_1001, 0xe243_3001];
    let cases = (0..16)
        .map(|v| {
            let mut r = [v; 16];
            r[2] = 0x1ff00020;
            r[15] = START;
            case(&words, r, v << 28, 4, 4, false)
        })
        .collect();
    groups.push(group(&words, cases));
    let path = std::env::temp_dir().join(format!("a330-wasm-oracle-{}.json", std::process::id()));
    std::fs::write(&path, serde_json::to_vec(&groups).unwrap()).unwrap();
    let script = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../scripts/tests/a330-wasm-emitter.mjs");
    let result = Command::new("node")
        .arg(script)
        .arg(&path)
        .output()
        .expect("Node is required for the real Wasm differential test");
    std::fs::remove_file(path).unwrap();
    assert!(
        result.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    println!("{}", String::from_utf8_lossy(&result.stdout));
}

#[test]
fn unsupported_control_flow_and_double_transfers_end_prefix() {
    for w in [
        0xe12fff1e, 0xef000000, 0xe8bd8000, 0xe1c020d0, 0xe1c020f0, 0xe1a0f000, 0xfa000000,
    ] {
        let words = [
            DecodedArmInstruction::decode(0xe2800001),
            DecodedArmInstruction::decode(w),
        ];
        assert_eq!(emitter::prefix_len(&words), 1, "{w:x}");
    }
    assert_eq!(std::mem::size_of::<emitter::Context>(), 40);
}

#[test]
fn cache_hints_survive_collisions_and_bounded_recycling() {
    let mut engine = super::Engine::new();
    let mut hint = usize::MAX;
    let kept = engine.entry_index(START, &mut hint);
    engine.entries[kept].request = 1;
    for i in 1..(super::SLOTS * 3) {
        let mut cold = usize::MAX;
        engine.entry_index(START + (i as u32) * 0x4000, &mut cold);
    }
    assert_eq!(engine.entries.len(), super::SLOTS);
    assert_eq!(engine.entry_index(START, &mut hint), kept);
    assert_eq!(engine.entries[kept].request, 1);
    engine.clear();
    assert_eq!(engine.entry_index(START + 4, &mut hint), 0);
    assert_eq!(engine.entries[hint].start, START + 4);
    engine.entry_index(START, &mut hint);
    assert_eq!(engine.entries[hint].start, START);
}
