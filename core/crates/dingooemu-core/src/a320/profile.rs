//! Optional diagnostic build only. Guest execution and save states are unchanged.
use serde_json::{json, Value};
use std::{collections::HashMap, time::Instant};

const MAX_BLOCKS: usize = 8192;
const SAMPLE_MASK: u32 = 1023;

#[derive(Default)]
pub(super) struct CacheProfile {
    pub enabled: bool,
    pub clear_reasons: [u64; 3],
    pub discarded_requests: u64,
    pub discarded_ready: u64,
    pub code_mismatches: u64,
    pub evictions: u64,
    pub fallbacks: [u64; 10],
}

impl CacheProfile {
    pub fn fallback(&mut self, reason: usize) {
        if self.enabled {
            self.fallbacks[reason] += 1;
        }
    }
    pub fn report(&self) -> Value {
        let names = [
            "disabledOrNoSession",
            "cold",
            "frameCompileBudget",
            "requestCap",
            "knownUnsupportedOrFailed",
            "pendingCompilation",
            "instructionBudget",
            "compiledExitGuard",
            "prefixShorterThanFour",
            "submitRejected",
        ];
        json!({"clearReasons":{"runtime":self.clear_reasons[0],"disabled":self.clear_reasons[1],"entryCap":self.clear_reasons[2]},
            "discardedRequests":self.discarded_requests,"discardedReadyEntries":self.discarded_ready,"codeMismatches":self.code_mismatches,"unsubmittedEvictions":self.evictions,
            "fallbacks":names.iter().zip(self.fallbacks).map(|(name,count)|json!({"reason":name,"count":count})).collect::<Vec<_>>()})
    }
}

pub(super) struct Sample {
    pc: u32,
    words: Vec<u32>,
    delay: bool,
}
impl Sample {
    pub(super) fn refetched(pc: u32, words: &[u32], delay: bool) -> Self {
        Self {
            pc,
            words: words.to_vec(),
            delay,
        }
    }
}

#[derive(Default)]
struct Block {
    samples: u64,
    instructions: u64,
    compiled_instructions: u64,
    operations: Vec<&'static str>,
}

#[derive(Default)]
struct Hook {
    calls: u64,
    ns: u128,
}

pub(super) struct Profile {
    enabled: bool,
    random: u32,
    dispatches: u64,
    samples: u64,
    instructions: u64,
    compiled_instructions: u64,
    eligible_prefix_instructions: u64,
    eligible_prefixes: u64,
    delay_samples: u64,
    untracked_samples: u64,
    operations: HashMap<&'static str, u64>,
    exits: HashMap<&'static str, u64>,
    blocks: HashMap<u32, Block>,
    hooks: HashMap<String, Hook>,
    frames: u64,
    tick_ns: u128,
    slices_ns: u128,
    finish_ns: u128,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            enabled: false,
            random: 0x9e37_79b9,
            dispatches: 0,
            samples: 0,
            instructions: 0,
            compiled_instructions: 0,
            eligible_prefix_instructions: 0,
            eligible_prefixes: 0,
            delay_samples: 0,
            untracked_samples: 0,
            operations: HashMap::new(),
            exits: HashMap::new(),
            blocks: HashMap::new(),
            hooks: HashMap::new(),
            frames: 0,
            tick_ns: 0,
            slices_ns: 0,
            finish_ns: 0,
        }
    }
}

impl Profile {
    pub(super) fn begin(&mut self) {
        *self = Self {
            enabled: true,
            ..Self::default()
        };
    }
    pub(super) fn end(&mut self) {
        self.enabled = false;
    }
    pub(super) fn timer(&self) -> Option<Instant> {
        self.enabled.then(Instant::now)
    }

    pub(super) fn sample(&mut self, pc: u32, words: &[u32], delay: bool) -> Option<Sample> {
        if !self.enabled {
            return None;
        }
        self.dispatches += 1;
        // Pseudorandom selection avoids aliasing with fixed loop/dispatch strides.
        self.random ^= self.random << 13;
        self.random ^= self.random >> 17;
        self.random ^= self.random << 5;
        if self.random & SAMPLE_MASK != 0 {
            return None;
        }
        Some(Sample {
            pc,
            words: words.to_vec(),
            delay,
        })
    }

    pub(super) fn record(&mut self, sample: Option<Sample>, completed: usize, compiled: bool) {
        let Some(sample) = sample else {
            return;
        };
        let words = &sample.words[..completed.min(sample.words.len())];
        self.samples += 1;
        self.instructions += words.len() as u64;
        if compiled {
            self.compiled_instructions += words.len() as u64;
        }
        for &word in words {
            *self.operations.entry(mnemonic(word)).or_default() += 1;
        }
        if sample.delay {
            self.delay_samples += 1;
        } else {
            let prefix = super::wasm_jit::profile_prefix_len(words);
            if prefix >= 4 {
                self.eligible_prefixes += 1;
                self.eligible_prefix_instructions += prefix as u64;
            }
            if let Some(&word) = sample
                .words
                .get(super::wasm_jit::profile_prefix_len(&sample.words))
            {
                *self.exits.entry(mnemonic(word)).or_default() += 1;
            }
        }
        if self.blocks.len() < MAX_BLOCKS || self.blocks.contains_key(&sample.pc) {
            let block = self.blocks.entry(sample.pc).or_default();
            block.samples += 1;
            block.instructions += words.len() as u64;
            if compiled {
                block.compiled_instructions += words.len() as u64;
            }
            // Mnemonics identify the sampled path without exporting guest bytes.
            block.operations = words.iter().map(|&word| mnemonic(word)).collect();
        } else {
            self.untracked_samples += 1;
        }
    }

    pub(super) fn hook(&mut self, name: &str, start: Option<Instant>) {
        if let Some(start) = start {
            let ns = start.elapsed().as_nanos();
            let hook = self.hooks.entry(name.to_owned()).or_default();
            hook.calls += 1;
            hook.ns += ns;
        }
    }
    pub(super) fn slice(&mut self, start: Option<Instant>) {
        if let Some(start) = start {
            self.slices_ns += start.elapsed().as_nanos();
        }
    }
    pub(super) fn finish(&mut self, tick: Option<Instant>, tail: Option<Instant>) {
        if let Some(tail) = tail {
            self.finish_ns += tail.elapsed().as_nanos();
        }
        if let Some(tick) = tick {
            self.frames += 1;
            self.tick_ns += tick.elapsed().as_nanos();
        }
    }
    pub(super) fn report(&self) -> Value {
        let mut blocks: Vec<_> = self.blocks.iter().collect();
        blocks.sort_by_key(|&(pc, block)| (std::cmp::Reverse(block.instructions), *pc));
        let mut interpreted_blocks: Vec<_> = self
            .blocks
            .iter()
            .filter(|(_, block)| block.instructions > block.compiled_instructions)
            .collect();
        interpreted_blocks.sort_by_key(|&(pc, block)| {
            (
                std::cmp::Reverse(block.instructions - block.compiled_instructions),
                *pc,
            )
        });
        let block_report = |(pc, block): (&u32, &Block)| {
            json!({"pc":format!("{pc:#010x}"),
            "samples":block.samples,"sampledInstructions":block.instructions,
            "sampledCompiledInstructions":block.compiled_instructions,
            "sampledInterpretedInstructions":block.instructions - block.compiled_instructions,
            "operations":block.operations})
        };
        let mut operations: Vec<_> = self.operations.iter().collect();
        operations.sort_by_key(|&(name, count)| (std::cmp::Reverse(*count), *name));
        let mut exits: Vec<_> = self.exits.iter().collect();
        exits.sort_by_key(|&(name, count)| (std::cmp::Reverse(*count), *name));
        let mut hooks: Vec<_> = self.hooks.iter().collect();
        hooks.sort_by_key(|&(name, hook)| (std::cmp::Reverse(hook.ns), name.as_str()));
        let hook_ns: u128 = self.hooks.values().map(|hook| hook.ns).sum();
        json!({
            "schema": 1, "sampling": "xorshift block dispatch, probability 1/1024",
            "timingScope": "instrumented core; CPU slices include sampling/bookkeeping; not a speed benchmark",
            "frames": self.frames, "dispatches": self.dispatches, "sampledBlocks": self.samples,
            "sampledInstructions": self.instructions, "sampledCompiledInstructions": self.compiled_instructions,
            "sampledEligiblePrefixInstructions": self.eligible_prefix_instructions,
            "sampledEligiblePrefixes": self.eligible_prefixes, "sampledDelayEntries": self.delay_samples,
            "untrackedBlockSamples": self.untracked_samples,
            "phaseMs": {"tick": self.tick_ns as f64 / 1e6, "cpuSlicesIncludingSdk": self.slices_ns as f64 / 1e6,
                "sdk": hook_ns as f64 / 1e6, "frameFinish": self.finish_ns as f64 / 1e6},
            "opcodes": operations.into_iter().map(|(name,count)| json!({"name": name,"samples": count})).collect::<Vec<_>>(),
            "prefixExits": exits.into_iter().map(|(name,count)| json!({"name": name,"samples": count})).collect::<Vec<_>>(),
            "hotBlocks": blocks.into_iter().take(32).map(block_report).collect::<Vec<_>>(),
            "hotInterpretedBlocks": interpreted_blocks.into_iter().take(32).map(block_report).collect::<Vec<_>>(),
            "sdkHooks": hooks.into_iter().map(|(name,hook)| json!({"name":name,"calls":hook.calls,"ms":hook.ns as f64/1e6})).collect::<Vec<_>>()
        })
    }
}

fn mnemonic(word: u32) -> &'static str {
    if word == 0 {
        return "NOP";
    }
    match word >> 26 {
        0 => match word & 63 {
            0 => "SLL",
            2 => "SRL",
            3 => "SRA",
            4 => "SLLV",
            6 => "SRLV",
            7 => "SRAV",
            8 => "JR",
            9 => "JALR",
            10 => "MOVZ",
            11 => "MOVN",
            12 => "SYSCALL",
            13 => "BREAK",
            15 => "SYNC",
            16 => "MFHI",
            17 => "MTHI",
            18 => "MFLO",
            19 => "MTLO",
            24 => "MULT",
            25 => "MULTU",
            26 => "DIV",
            27 => "DIVU",
            32 => "ADD",
            33 => "ADDU",
            34 => "SUB",
            35 => "SUBU",
            36 => "AND",
            37 => "OR",
            38 => "XOR",
            39 => "NOR",
            42 => "SLT",
            43 => "SLTU",
            _ => "SPECIAL_OTHER",
        },
        1 => match (word >> 16) & 31 {
            0 => "BLTZ",
            1 => "BGEZ",
            16 => "BLTZAL",
            17 => "BGEZAL",
            _ => "REGIMM_OTHER",
        },
        2 => "J",
        3 => "JAL",
        4 => "BEQ",
        5 => "BNE",
        6 => "BLEZ",
        7 => "BGTZ",
        8 => "ADDI",
        9 => "ADDIU",
        10 => "SLTI",
        11 => "SLTIU",
        12 => "ANDI",
        13 => "ORI",
        14 => "XORI",
        15 => "LUI",
        28 => match word & 63 {
            0 => "MADD",
            1 => "MADDU",
            2 => "MUL",
            4 => "MSUB",
            5 => "MSUBU",
            32 => "CLZ",
            33 => "CLO",
            _ => "SPECIAL2_OTHER",
        },
        32 => "LB",
        33 => "LH",
        34 => "LWL",
        35 => "LW",
        36 => "LBU",
        37 => "LHU",
        38 => "LWR",
        40 => "SB",
        41 => "SH",
        42 => "SWL",
        43 => "SW",
        46 => "SWR",
        48 => "LL",
        51 => "PREF",
        56 => "SC",
        _ => "OTHER",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn records_only_completed_instructions_and_delay_blocks_are_not_candidates() {
        let mut profile = Profile::default();
        profile.begin();
        profile.record(
            Some(Sample {
                pc: 0x1000,
                words: vec![0; 6],
                delay: false,
            }),
            4,
            true,
        );
        profile.record(
            Some(Sample {
                pc: 0x2000,
                words: vec![0x8c080000, 0],
                delay: true,
            }),
            1,
            false,
        );
        let report = profile.report();
        assert_eq!(report["sampledInstructions"], 5);
        assert_eq!(report["sampledCompiledInstructions"], 4);
        assert_eq!(report["sampledEligiblePrefixInstructions"], 4);
        assert_eq!(report["sampledDelayEntries"], 1);
        assert_eq!(report["opcodes"][0]["name"], "NOP");
        assert_eq!(report["hotBlocks"][0]["sampledCompiledInstructions"], 4);
        assert_eq!(report["hotInterpretedBlocks"][0]["pc"], "0x00002000");
        assert_eq!(
            report["hotInterpretedBlocks"][0]["sampledInterpretedInstructions"],
            1
        );
    }
    #[test]
    fn sampler_is_disabled_by_default_and_spreads_over_loop_positions() {
        let mut profile = Profile::default();
        assert!(profile.sample(0, &[0], false).is_none());
        assert_eq!(profile.dispatches, 0);
        profile.begin();
        let mut positions = [0u32; 16];
        for index in 0..262144 {
            if profile.sample(index % 16, &[0], false).is_some() {
                positions[(index % 16) as usize] += 1;
            }
        }
        assert!(positions.iter().all(|&count| count > 0));
        let total: u32 = positions.iter().sum();
        assert!((180..340).contains(&total));
        profile.end();
        assert!(profile.sample(0, &[0], false).is_none());
    }
    #[test]
    fn opcode_names_distinguish_memory_branches_and_hilo() {
        assert_eq!(mnemonic(0x8c080000), "LW");
        assert_eq!(mnemonic(0x1000ffff), "BEQ");
        assert_eq!(mnemonic(0x012a0018), "MULT");
        assert_eq!(mnemonic(0x00000812), "MFLO");
    }
}
