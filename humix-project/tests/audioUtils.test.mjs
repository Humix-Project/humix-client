import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/utils/audioUtils.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
});
const { audioBufferToBars, trimAudioBuffer, MAX_HUMMING_SECONDS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const buffer = (...channels) => ({
  length: channels[0].length,
  numberOfChannels: channels.length,
  getChannelData: (index) => Float32Array.from(channels[index]),
});

test("silence stays zero and amplitudes retain their scale", () => {
  assert.deepEqual(audioBufferToBars(buffer([0, 0, 0.25, -0.5, 1, 0]), 3), [0, 50, 100]);
});

test("opposite-phase stereo does not cancel the waveform", () => {
  assert.deepEqual(audioBufferToBars(buffer([0.5, 1], [-0.5, -1]), 2), [50, 100]);
});

test("uneven sample counts include the final transient", () => {
  assert.deepEqual(audioBufferToBars(buffer([0, 0, 0, 0, 1]), 2), [0, 100]);
});

test("short clips fill the timeline without invalid or empty tail bars", () => {
  assert.deepEqual(audioBufferToBars(buffer([0.5, 1]), 4), [50, 50, 100, 100]);
  assert.deepEqual(audioBufferToBars(buffer([]), 2), [0, 0]);
  assert.deepEqual(audioBufferToBars(buffer([1]), 0), []);
});

test("recordings are capped at 30 seconds, preserving both channels", (t) => {
  class TestAudioBuffer {
    constructor({ length, numberOfChannels, sampleRate }) {
      Object.assign(this, { length, numberOfChannels, sampleRate });
      this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    }
    getChannelData(index) { return this.channels[index]; }
    copyToChannel(samples, index) { this.channels[index].set(samples); }
  }
  const original = globalThis.AudioBuffer;
  globalThis.AudioBuffer = TestAudioBuffer;
  t.after(() => {
    if (original === undefined) delete globalThis.AudioBuffer;
    else globalThis.AudioBuffer = original;
  });
  const make = (length) => new TestAudioBuffer({ length, numberOfChannels: 2, sampleRate: 100 });
  const exact = make(3000);
  assert.equal(trimAudioBuffer(exact, MAX_HUMMING_SECONDS), exact);
  const short = make(2999);
  assert.equal(trimAudioBuffer(short, MAX_HUMMING_SECONDS), short);
  for (const length of [3001, 4500]) {
    const long = make(length);
    long.channels[0].fill(0.5);
    long.channels[1].fill(-0.25);
    const trimmed = trimAudioBuffer(long, MAX_HUMMING_SECONDS);
    assert.equal(trimmed.length, 3000);
    assert.equal(trimmed.channels[0][2999], 0.5);
    assert.equal(trimmed.channels[1][2999], -0.25);
  }
  // A 30-second original with 2.5 seconds selected only permits 2.5 seconds of replacement.
  assert.equal(trimAudioBuffer(make(500), 2.5).length, 250);
  assert.throws(() => trimAudioBuffer(make(100), 0));
});
