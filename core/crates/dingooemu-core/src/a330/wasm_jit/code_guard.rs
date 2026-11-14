/// Compare every code byte, including instructions whose conditions are false.
/// External RAM writes can bypass the emulated bus's invalidation hooks.
#[inline(always)]
pub(crate) fn equal_code(actual: &[u8], expected: &[u8]) -> bool {
    if actual.len() != expected.len() {
        return false;
    }
    match actual.len() {
        8 => {
            u64::from_le_bytes(actual.try_into().unwrap())
                == u64::from_le_bytes(expected.try_into().unwrap())
        }
        12 => {
            u64::from_le_bytes(actual[..8].try_into().unwrap())
                == u64::from_le_bytes(expected[..8].try_into().unwrap())
                && u32::from_le_bytes(actual[8..].try_into().unwrap())
                    == u32::from_le_bytes(expected[8..].try_into().unwrap())
        }
        16 => {
            u64::from_le_bytes(actual[..8].try_into().unwrap())
                == u64::from_le_bytes(expected[..8].try_into().unwrap())
                && u64::from_le_bytes(actual[8..].try_into().unwrap())
                    == u64::from_le_bytes(expected[8..].try_into().unwrap())
        }
        20 => {
            u64::from_le_bytes(actual[0..8].try_into().unwrap())
                == u64::from_le_bytes(expected[0..8].try_into().unwrap())
                && u64::from_le_bytes(actual[8..16].try_into().unwrap())
                    == u64::from_le_bytes(expected[8..16].try_into().unwrap())
                && u32::from_le_bytes(actual[16..20].try_into().unwrap())
                    == u32::from_le_bytes(expected[16..20].try_into().unwrap())
        }
        24 => {
            u64::from_le_bytes(actual[0..8].try_into().unwrap())
                == u64::from_le_bytes(expected[0..8].try_into().unwrap())
                && u64::from_le_bytes(actual[8..16].try_into().unwrap())
                    == u64::from_le_bytes(expected[8..16].try_into().unwrap())
                && u64::from_le_bytes(actual[16..24].try_into().unwrap())
                    == u64::from_le_bytes(expected[16..24].try_into().unwrap())
        }
        28 => {
            u64::from_le_bytes(actual[0..8].try_into().unwrap())
                == u64::from_le_bytes(expected[0..8].try_into().unwrap())
                && u64::from_le_bytes(actual[8..16].try_into().unwrap())
                    == u64::from_le_bytes(expected[8..16].try_into().unwrap())
                && u64::from_le_bytes(actual[16..24].try_into().unwrap())
                    == u64::from_le_bytes(expected[16..24].try_into().unwrap())
                && u32::from_le_bytes(actual[24..28].try_into().unwrap())
                    == u32::from_le_bytes(expected[24..28].try_into().unwrap())
        }
        // All bytes are still compared on every invocation. Safe unaligned
        // loads are bounded by the remaining slice, including the final tail.
        32.. => {
            let mut offset = 0;
            while actual.len() - offset >= 32 {
                let a = &actual[offset..offset + 32];
                let b = &expected[offset..offset + 32];
                let diff = (u64::from_le_bytes(a[0..8].try_into().unwrap())
                    ^ u64::from_le_bytes(b[0..8].try_into().unwrap()))
                    | (u64::from_le_bytes(a[8..16].try_into().unwrap())
                        ^ u64::from_le_bytes(b[8..16].try_into().unwrap()))
                    | (u64::from_le_bytes(a[16..24].try_into().unwrap())
                        ^ u64::from_le_bytes(b[16..24].try_into().unwrap()))
                    | (u64::from_le_bytes(a[24..32].try_into().unwrap())
                        ^ u64::from_le_bytes(b[24..32].try_into().unwrap()));
                if diff != 0 {
                    return false;
                }
                offset += 32;
            }
            while actual.len() - offset >= 8 {
                if u64::from_le_bytes(actual[offset..offset + 8].try_into().unwrap())
                    != u64::from_le_bytes(expected[offset..offset + 8].try_into().unwrap())
                {
                    return false;
                }
                offset += 8;
            }
            actual[offset..] == expected[offset..]
        }
        _ => actual == expected,
    }
}

#[cfg(test)]
mod tests {
    use super::equal_code;

    #[test]
    fn compares_every_byte_and_length() {
        for length in 0..=520 {
            let expected: Vec<u8> = (0..length).map(|i| (i * 37 + 19) as u8).collect();
            assert!(equal_code(&expected, &expected));
            for offset in 0..length {
                let mut actual = expected.clone();
                actual[offset] ^= 1;
                assert!(!equal_code(&actual, &expected));
            }
            let mut longer = expected.clone();
            longer.push(0);
            assert!(!equal_code(&longer, &expected));
            assert!(!equal_code(&expected, &longer));
        }
    }
}

#[cfg(test)]
mod alignment_tests {
    use super::equal_code;
    #[test]
    fn independent_subslice_alignments_and_tail_mutations() {
        for length in [
            8, 12, 16, 20, 24, 28, 31, 32, 33, 36, 63, 64, 65, 128, 252, 256, 260, 511, 512,
        ] {
            for left in 0..8 {
                for right in 0..8 {
                    let a: Vec<u8> = (0..length + 8)
                        .map(|i| ((i as i32 - left as i32) * 37 + 19) as u8)
                        .collect();
                    let mut b: Vec<u8> = (0..length + 8)
                        .map(|i| ((i as i32 - right as i32) * 37 + 19) as u8)
                        .collect();
                    assert!(equal_code(
                        &a[left..left + length],
                        &b[right..right + length]
                    ));
                    for byte in 0..length {
                        b[right + byte] ^= 0x80;
                        assert!(!equal_code(
                            &a[left..left + length],
                            &b[right..right + length]
                        ));
                        b[right + byte] ^= 0x80;
                    }
                }
            }
        }
    }
}
