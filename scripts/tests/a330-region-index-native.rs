// Standard memory mapping only. Frozen linear byte-slice API is the reference.
use super::*;
fn empty(profile: ArmProfile) -> Memory {
    Memory {
        profile,
        system_ram: vec![0; SYSTEM_RAM_SIZE],
        stack: vec![0; STACK_SIZE],
        heap: vec![0; HEAP_SIZE],
        framebuffer: vec![0; FRAMEBUFFER_SIZE],
        low_memory: vec![0; LEGACY_LOW_MEMORY_SIZE],
        legacy_mmio: vec![0; LEGACY_MMIO_SIZE],
        legacy_audio_mmio: vec![0; LEGACY_AUDIO_MMIO_SIZE],
        legacy_system_mmio: vec![0; LEGACY_SYSTEM_MMIO_SIZE],
    }
}
fn check<const N: usize>(a: &mut Memory, b: &mut Memory, address: u32, seed: u32) {
    let expected = b
        .read_bytes(address, N)
        .map(|v| <[u8; N]>::try_from(v).unwrap())
        .map_err(|e| e.to_string());
    assert_eq!(
        a.fixed_read::<N>(address).map_err(|e| e.to_string()),
        expected,
        "read {address:#x}/{N}"
    );
    let mut value = [0; N];
    for (i, v) in value.iter_mut().enumerate() {
        *v = seed.rotate_right(i as u32 * 7) as u8;
    }
    assert_eq!(
        a.fixed_write(address, value).map_err(|e| e.to_string()),
        b.write_bytes(address, &value).map_err(|e| e.to_string()),
        "write {address:#x}/{N}"
    );
    assert_eq!(
        a.read_bytes(address, N).ok(),
        b.read_bytes(address, N).ok(),
        "after write {address:#x}/{N}"
    );
}
#[test]
fn all_mapping_edges_random_offsets_and_errors_match_frozen_linear() {
    let mut cases = 0;
    for profile in [ArmProfile::Retail, ArmProfile::Homebrew] {
        let mut a = empty(profile);
        let mut b = a.clone();
        let regions = [
            (0, LEGACY_LOW_MEMORY_SIZE),
            (SYSTEM_RAM_BASE, SYSTEM_RAM_SIZE),
            (STACK_BASE, STACK_SIZE),
            (a.heap_base(), HEAP_SIZE),
            (FRAMEBUFFER_BASE, FRAMEBUFFER_SIZE),
            (LEGACY_MMIO_BASE, LEGACY_MMIO_SIZE),
            (LEGACY_AUDIO_MMIO_BASE, LEGACY_AUDIO_MMIO_SIZE),
            (LEGACY_SYSTEM_MMIO_BASE, LEGACY_SYSTEM_MMIO_SIZE),
        ];
        let mut addresses = vec![
            u32::MAX,
            u32::MAX - 1,
            u32::MAX - 3,
            0x08ff_ffff,
            0x0900_0000,
            0x0930_ffff,
            0x0931_0000,
            0x0aff_ffff,
            0x20ff_ffff,
            0x2100_0000,
            0x22ff_ffff,
            0x2300_0000,
        ];
        for (base, len) in regions {
            for edge in [base, base.wrapping_add(len as u32)] {
                for delta in -8i32..=8 {
                    addresses.push(edge.wrapping_add(delta as u32));
                }
            }
        }
        let mut seed = 0x47c3_9021u32;
        for i in 0..100_000 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let address = if i % 4 == 0 {
                seed
            } else {
                let (base, len) = regions[i % regions.len()];
                base.wrapping_add(seed % (len as u32 + 8)).wrapping_sub(4)
            };
            addresses.push(address);
        }
        for address in addresses {
            check::<1>(&mut a, &mut b, address, seed);
            check::<2>(&mut a, &mut b, address, seed);
            check::<4>(&mut a, &mut b, address, seed);
            cases += 3;
            seed = seed.rotate_left(3).wrapping_add(address);
        }
        assert_eq!(a.system_ram, b.system_ram);
        assert_eq!(a.stack, b.stack);
        assert_eq!(a.heap, b.heap);
        assert_eq!(a.framebuffer, b.framebuffer);
        assert_eq!(a.low_memory, b.low_memory);
        assert_eq!(a.legacy_mmio, b.legacy_mmio);
        assert_eq!(a.legacy_audio_mmio, b.legacy_audio_mmio);
        assert_eq!(a.legacy_system_mmio, b.legacy_system_mmio);
    }
    println!("REGION_INDEX_READ_WRITE_CASES={cases}");
}
