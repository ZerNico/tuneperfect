use dywapitchtrack::DywaPitchTracker;
use ringbuf::{
    traits::{Consumer, RingBuffer},
    HeapRb,
};

use super::recorder::MicrophoneOptions;

pub struct Processor {
    audio_buffer: HeapRb<f32>,
    pitchtracker: DywaPitchTracker,
    options: MicrophoneOptions,
    samples_per_beat: usize,
}

impl Processor {
    pub fn new(options: MicrophoneOptions, sample_rate: u32, samples_per_beat: usize) -> Self {
        let audio_buffer = HeapRb::new(sample_rate as usize);
        let mut pitchtracker = DywaPitchTracker::new();
        pitchtracker.sample_rate_hz = sample_rate as i32;

        Self {
            audio_buffer,
            pitchtracker,
            options,
            samples_per_beat,
        }
    }

    pub fn push_audio_data(&mut self, data: &[f32]) {
        let gained_data: Vec<f32> = data.iter().map(|&sample| self.apply_gain(sample)).collect();
        self.audio_buffer.push_slice_overwrite(&gained_data);
    }

    pub fn get_pitch(&mut self) -> f32 {
        let slices = self.audio_buffer.as_slices();
        let samples = [slices.0, slices.1].concat();
        
        if samples.len() < self.samples_per_beat {
            return -1.0;
        }
        
        let start_sample = samples.len() - self.samples_per_beat;

        let mut pitch = -1.0;

        if self.above_noise_threshold(&samples, start_sample) {
            pitch = self
                .pitchtracker
                .compute_pitch(&samples, start_sample, self.samples_per_beat);
        }

        if pitch <= 0.0 {
            self.pitchtracker.clear_pitch_history();
        }

        pitch
    }

    fn apply_gain(&self, sample: f32) -> f32 {
        (sample * self.options.gain).clamp(-1.0, 1.0)
    }

    fn above_noise_threshold(&self, data: &[f32], start_sample: usize) -> bool {
        let min_threshold = self.options.threshold / 100.0;
        let end_sample = start_sample + self.samples_per_beat;

        if end_sample > data.len() {
            return false;
        }

        data[start_sample..end_sample]
            .iter()
            .any(|&sample| sample > min_threshold)
    }
}
