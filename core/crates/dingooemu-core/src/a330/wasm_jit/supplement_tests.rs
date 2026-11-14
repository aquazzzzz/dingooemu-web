use super::*;
const START: u32 = 0x10100000;
fn memory() -> Memory {
    let mut bytes = vec![0u8; 384];
    for (at, magic) in [(0, b"CCDL"), (32, b"IMPT"), (64, b"EXPT"), (96, b"RAWD")] {
        bytes[at..at + 4].copy_from_slice(magic);
    }
    for (at, n) in [
        (0x68, 128u32),
        (0x6c, 256),
        (0x74, START),
        (0x78, START),
        (0x7c, 256),
    ] {
        bytes[at..at + 4].copy_from_slice(&n.to_le_bytes());
    }
    bytes[128..132].copy_from_slice(&0xe2800001u32.to_le_bytes());
    bytes[132..136].copy_from_slice(&0xeafffffdu32.to_le_bytes());
    Memory::from_package(
        &crate::package::PackageImage::parse(&bytes, crate::content::ContentFormat::C3s).unwrap(),
    )
    .unwrap()
}
fn engine(tier: u8) -> Engine {
    let mut e = Engine::new();
    e.session = 1;
    e.requests = 1;
    e.base_submissions = 256;
    e.extra_requests = usize::from(tier == 2);
    let mut hint = usize::MAX;
    let i = e.entry_index(START, &mut hint);
    e.entries[i].request = 1;
    e.entries[i].tier = tier;
    e.entries[i].code = [0xe2800001u32, 0xeafffffdu32]
        .iter()
        .flat_map(|x| x.to_le_bytes())
        .collect();
    e
}
#[test]
fn extra_scope_preserves_base_and_checks_code_before_fallback() {
    let mut m = memory();
    let d = [
        DecodedArmInstruction::decode(0xe2800001),
        DecodedArmInstruction::decode(0xeafffffd),
    ];
    for (tier, q, poll_expected) in [
        (2, 256000, false),
        (2, 1, false),
        (2, 256001, true),
        (1, 256000, true),
    ] {
        let mut e = engine(tier);
        let mut c = Cpu::new(START, 0, 0);
        c.start();
        let old = c.r;
        let mut ctx = SliceContext::bind(&mut m, START, START + 256);
        let mut hint = 0;
        assert!(matches!(
            e.execute(&d, 64, &mut c, &mut m, &mut ctx, q, &mut hint),
            Execution::Fallback
        ));
        // Native poll stub=-1: only an eligible path may consume the request.
        assert_eq!(e.requests, usize::from(!poll_expected));
        assert_eq!(c.r, old);
    }
    let mut e = engine(2);
    m.write32(START, 0xe2800002).unwrap();
    let mut c = Cpu::new(START, 0, 0);
    let mut ctx = SliceContext::bind(&mut m, START, START + 256);
    let mut hint = 0;
    assert!(matches!(
        e.execute(&d, 64, &mut c, &mut m, &mut ctx, 1, &mut hint),
        Execution::Stale
    ));
    assert_eq!(e.extra_requests, 0);
    assert_eq!(e.entries[0].tier, 2);
    assert_eq!(e.invalidations, 1);
}
#[test]
fn original_identity_survives_stale_and_bounded_recycling() {
    let mut e = Engine::new();
    let mut hint = usize::MAX;
    let base = e.entry_index(START, &mut hint);
    e.entries[base].tier = 1;
    e.entries[base].request = 0;
    for i in 1..SLOTS * 3 {
        let mut h = usize::MAX;
        e.entry_index(START + (i as u32) * 0x4000, &mut h);
    }
    assert_eq!(e.entry_index(START, &mut hint), base);
    assert_eq!(e.entries[base].tier, 1);
    assert_eq!(e.entries.len(), SLOTS);
}
#[test]
fn clear_starts_fresh_cohort_without_changing_configured_limit() {
    let mut e = engine(2);
    e.clear();
    assert_eq!(e.base_submissions, 0);
    assert_eq!(e.extra_requests, 0);
    assert_eq!(e.requests, 0);
    assert!(e.entries.is_empty());
    assert_eq!(e.request_limit, 320);
}

#[test]
fn short_extra_is_memoized_but_original_short_still_attempts() {
    for (base, limit, expected_budget) in [(0, 256, 1), (256, 320, 2)] {
        let mut m = memory();
        let mut e = Engine::new();
        e.session = 1;
        e.base_submissions = base;
        e.request_limit = limit;
        let mut h = usize::MAX;
        let i = e.entry_index(START, &mut h);
        e.entries[i].hits = HOT;
        let mut c = Cpu::new(START, 0, 0);
        c.start();
        let mut context = SliceContext::bind(&mut m, START, START + 256);
        let mut hint = usize::MAX;
        let words = [
            DecodedArmInstruction::decode(0xe2800001),
            DecodedArmInstruction::decode(0xeafffffd),
        ];
        assert!(matches!(
            e.execute(&words, 64, &mut c, &mut m, &mut context, 300000, &mut hint),
            Execution::Fallback
        ));
        assert!(e.entries[hint].failed);
        assert_eq!(e.budget, expected_budget);
        let old = e.entries[hint].hits;
        e.execute(&words, 64, &mut c, &mut m, &mut context, 300000, &mut hint);
        assert_eq!(e.entries[hint].hits, old);
    }
}
