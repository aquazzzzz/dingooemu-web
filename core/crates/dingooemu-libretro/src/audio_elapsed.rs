//! Owning-thread, host-only PCM credit. Units are frame-nanoseconds, so callback
//! splitting cannot lose fractional frames. This clock never enters guest state.
pub const RATE: u64 = 22_050;
pub const SECOND: u64 = 1_000_000_000;
pub const MAX_FRAMES: usize = (RATE * 64 / 1000) as usize;
const MAX_CREDIT: u64 = RATE * 64_000_000;
const MAX_GAP: u64 = 250_000_000;
#[derive(Default, Debug)]
pub struct Budget {
    last: Option<u64>,
    pub credit: u64,
    pub clipped: u64,
    pub discontinuities: u64,
}
impl Budget {
    pub const fn new() -> Self {
        Self {
            last: None,
            credit: 0,
            clipped: 0,
            discontinuities: 0,
        }
    }
    pub fn request(&mut self, now: u64) -> usize {
        if let Some(last) = self.last {
            match now.checked_sub(last) {
                Some(dt) if dt <= MAX_GAP => {
                    let total = self.credit + dt * RATE;
                    self.credit = total.min(MAX_CREDIT);
                    self.clipped += total - self.credit;
                }
                _ => {
                    self.credit = 0;
                    self.discontinuities += 1;
                }
            }
        }
        self.last = Some(now);
        (self.credit / SECOND) as usize
    }
    pub fn debit(&mut self, real: usize) {
        assert!(real <= MAX_FRAMES && real as u64 * SECOND <= self.credit);
        self.credit -= real as u64 * SECOND;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn run(times: &[u64]) -> (u64, u64) {
        let mut b = Budget::new();
        let mut total = 0;
        for &t in times {
            let n = b.request(t);
            b.debit(n);
            total += n as u64;
        }
        (total, b.credit)
    }
    #[test]
    fn call_count_and_fraction_do_not_change_supply() {
        let regular: Vec<_> = (0..=1000).map(|i| i * 1_000_000).collect();
        let sparse: Vec<_> = (0..=20).map(|i| i * 50_000_000).collect();
        assert_eq!(run(&regular), (RATE, 0));
        assert_eq!(run(&sparse), (RATE, 0));
        let mut irregular = vec![0];
        let mut t = 0;
        while t < SECOND {
            t = (t + 13_710_719).min(SECOND);
            irregular.push(t);
        }
        assert_eq!(run(&irregular), (RATE, 0));
    }
    #[test]
    fn only_actual_pcm_is_debited_and_empty_credit_is_bounded() {
        let mut b = Budget::new();
        assert_eq!(b.request(0), 0);
        assert_eq!(b.request(20_000_000), 441);
        b.debit(13);
        assert_eq!(b.request(20_000_000), 428);
        b.debit(0);
        assert_eq!(b.request(220_000_000), MAX_FRAMES);
        assert!(b.clipped > 0);
        b.debit(MAX_FRAMES);
        assert!(b.credit < SECOND);
    }
    #[test]
    fn pause_restore_backwards_and_reset_rebase_without_catchup() {
        let mut b = Budget::new();
        b.request(0);
        b.request(50_000_000);
        assert_eq!(b.request(3_000_000_000), 0);
        assert_eq!(b.request(2_000_000_000), 0);
        assert_eq!(b.discontinuities, 2);
        assert_eq!(b.request(2_020_000_000), 441);
        b = Budget::new();
        assert_eq!(b.request(99_999_999_999), 0);
    }
    #[test]
    fn long_run_never_invents_samples_or_accumulates_rounding_drift() {
        let mut b = Budget::new();
        let mut total = 0u64;
        for i in 0..=36_000 {
            let t = i * 16_666_667;
            let n = b.request(t);
            assert!(n <= MAX_FRAMES);
            b.debit(n);
            total += n as u64;
            assert_eq!(total * SECOND + b.credit, t * RATE);
        }
    }
}
