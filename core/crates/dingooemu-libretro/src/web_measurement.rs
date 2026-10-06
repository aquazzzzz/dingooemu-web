use std::time::{Duration, Instant};

const CAPACITY: usize = 4096;

#[derive(Clone, Copy, Default)]
struct Sample {
    tick_ms: f64,
    video_ms: f64,
    audio_ms: f64,
    interval_ms: Option<f64>,
}

struct Measurement {
    enabled: bool,
    frames: u64,
    samples: Vec<Sample>,
    previous_start: Option<Instant>,
}

impl Measurement {
    const fn new() -> Self {
        Self {
            enabled: false,
            frames: 0,
            samples: Vec::new(),
            previous_start: None,
        }
    }

    fn record(&mut self, start: Instant, tick: Duration, video: Duration, audio: Duration) {
        if !self.enabled {
            return;
        }
        self.frames += 1;
        let interval_ms = self
            .previous_start
            .map(|previous| start.duration_since(previous).as_secs_f64() * 1000.0);
        self.previous_start = Some(start);
        if self.samples.len() < CAPACITY {
            self.samples.push(Sample {
                tick_ms: tick.as_secs_f64() * 1000.0,
                video_ms: video.as_secs_f64() * 1000.0,
                audio_ms: audio.as_secs_f64() * 1000.0,
                interval_ms,
            });
        }
    }

    fn metric(&self, index: u32) -> f64 {
        if index == 0 {
            return self.frames as f64;
        }
        if index == 9 {
            return self
                .samples
                .iter()
                .filter(|sample| sample.tick_ms + sample.video_ms + sample.audio_ms > 1000.0 / 60.0)
                .count() as f64;
        }
        if index == 10 {
            return self.samples.len() as f64;
        }
        if index == 11 {
            return f64::from(self.frames > self.samples.len() as u64);
        }
        if index == 15 {
            return self
                .samples
                .iter()
                .map(|sample| sample.tick_ms + sample.video_ms + sample.audio_ms)
                .sum::<f64>()
                / self.samples.len().max(1) as f64;
        }
        let values: Vec<f64> = self
            .samples
            .iter()
            .filter_map(|sample| match index {
                1 | 2 | 3 | 12 => Some(sample.tick_ms),
                4 | 13 => Some(sample.video_ms),
                5 | 14 => Some(sample.audio_ms),
                6 | 7 | 8 => sample.interval_ms,
                _ => None,
            })
            .collect();
        if values.is_empty() {
            return -1.0;
        }
        match index {
            1 | 4 | 5 | 6 => values.iter().sum::<f64>() / values.len() as f64,
            3 | 8 => values.into_iter().fold(0.0, f64::max),
            2 | 7 | 12 | 13 | 14 => percentile(values, if index == 12 { 0.5 } else { 0.95 }),
            _ => -1.0,
        }
    }
}

fn percentile(mut values: Vec<f64>, fraction: f64) -> f64 {
    values.sort_unstable_by(f64::total_cmp);
    values[(values.len() as f64 * fraction).ceil() as usize - 1]
}

// These entry points and retro_run all execute on the game's thread.
static mut STATE: Measurement = Measurement::new();

#[no_mangle]
pub extern "C" fn dingooemu_measure_begin() {
    unsafe {
        STATE = Measurement {
            enabled: true,
            samples: Vec::with_capacity(CAPACITY),
            ..Measurement::new()
        };
    }
}

#[no_mangle]
pub extern "C" fn dingooemu_measure_end() {
    unsafe {
        STATE.enabled = false;
    }
}

pub fn get(index: u32) -> f64 {
    unsafe { STATE.metric(index) }
}

pub fn frame_timer() -> Option<Instant> {
    unsafe { STATE.enabled.then(Instant::now) }
}

pub fn record_frame(start: Instant, tick: Duration, video: Duration, audio: Duration) {
    unsafe {
        STATE.record(start, tick, video, audio);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_intervals_and_phase_times_are_separate() {
        let mut measurement = Measurement {
            enabled: true,
            ..Measurement::new()
        };
        let start = Instant::now();
        for (offset, tick) in [(0, 10), (17, 20), (42, 30)] {
            measurement.record(
                start + Duration::from_millis(offset),
                Duration::from_millis(tick),
                Duration::from_millis(2),
                Duration::from_millis(1),
            );
        }
        assert_eq!(measurement.metric(0), 3.0);
        assert_eq!(measurement.metric(1), 20.0);
        assert_eq!(measurement.metric(2), 30.0);
        assert_eq!(measurement.metric(12), 20.0);
        assert_eq!(measurement.metric(6), 21.0);
        assert_eq!(measurement.metric(7), 25.0);
        assert_eq!(measurement.metric(9), 2.0);
        measurement.enabled = false;
        measurement.record(start, Duration::ZERO, Duration::ZERO, Duration::ZERO);
        assert_eq!(measurement.metric(0), 3.0);
    }

    #[test]
    fn missing_data_and_capacity_are_reported() {
        let mut measurement = Measurement {
            enabled: true,
            ..Measurement::new()
        };
        assert_eq!(measurement.metric(2), -1.0);
        for _ in 0..CAPACITY + 1 {
            measurement.record(
                Instant::now(),
                Duration::ZERO,
                Duration::ZERO,
                Duration::ZERO,
            );
        }
        assert_eq!(measurement.metric(10), CAPACITY as f64);
        assert_eq!(measurement.metric(11), 1.0);
        assert_eq!(measurement.metric(0), (CAPACITY + 1) as f64);
    }
}
