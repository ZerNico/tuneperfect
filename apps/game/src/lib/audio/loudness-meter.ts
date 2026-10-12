import { integratedLoudness } from "./loudness";

/**
 * Window per block: about 400 ms, as BS.1770 asks for. Sampling every 100 ms gives the
 * standard's 75% overlap.
 */
const BLOCK_SAMPLES = 16384;

export interface LoudnessMeter {
  /** Adds a block from the last ~400 ms of audio. */
  sample(): void;
  readonly blocks: number;
  /** Gated loudness of the blocks so far, in LUFS. */
  loudness(): number | null;
  reset(): void;
  dispose(): void;
}

/**
 * Measures the loudness of what plays through `input`, without touching its output.
 *
 * K-weighting is approximated with Web Audio's biquads, as close as a few tenths of a dB for
 * music: a +4 dB high shelf (the head's effect on what reaches the ear) and a 38 Hz high-pass.
 * Channels are measured separately and summed, so a wide stereo mix isn't undercounted.
 */
export function createLoudnessMeter(context: AudioContext, input: AudioNode): LoudnessMeter {
  // BS.1770's pre-filter: +4 dB above 1682 Hz with a Q of 0.71, which is Web Audio's fixed shelf slope.
  const shelf = new BiquadFilterNode(context, { type: "highshelf", frequency: 1682, gain: 4 });
  const highpass = new BiquadFilterNode(context, { type: "highpass", frequency: 38, Q: 0.5 });
  const splitter = new ChannelSplitterNode(context, { numberOfOutputs: 2 });
  const analysers = [0, 1].map(() => new AnalyserNode(context, { fftSize: BLOCK_SAMPLES }));

  input.connect(shelf).connect(highpass).connect(splitter);
  // Analysers are processed without being connected onwards.
  analysers.forEach((analyser, channel) => splitter.connect(analyser, channel));

  const buffer = new Float32Array(BLOCK_SAMPLES);
  const blocks: number[] = [];

  return {
    sample() {
      let sum = 0;
      for (const analyser of analysers) {
        analyser.getFloatTimeDomainData(buffer);
        let squares = 0;
        for (const value of buffer) squares += value * value;
        sum += squares / buffer.length;
      }
      blocks.push(sum);
    },
    get blocks() {
      return blocks.length;
    },
    loudness: () => integratedLoudness(blocks),
    reset() {
      blocks.length = 0;
    },
    dispose() {
      input.disconnect(shelf);
      for (const node of [shelf, highpass, splitter]) node.disconnect();
    },
  };
}
