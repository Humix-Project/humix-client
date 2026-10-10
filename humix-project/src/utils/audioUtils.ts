// 브라우저 MediaRecorder는 webm/mp4로만 녹음되므로,
// API 3.4.1.3 비고에 명시된 대로 업로드 전 wav로 변환한다.
// 외부 라이브러리 없이 Web Audio API의 OfflineAudioContext + 수동 WAV 헤더 작성으로 처리.

// webm/wav 등 브라우저가 디코딩 가능한 Blob -> AudioBuffer
export async function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    return audioBuffer;
  } finally {
    audioCtx.close();
  }
}

export async function webmBlobToWavBlob(webmBlob: Blob): Promise<Blob> {
  const audioBuffer = await blobToAudioBuffer(webmBlob);
  const wavArrayBuffer = audioBufferToWav(audioBuffer);
  return new Blob([wavArrayBuffer], { type: "audio/wav" });
}

// ── 구간 교체 (재녹음 patch) ────────────────────────────────────
// baseBuffer의 [startRatio, endRatio] 구간을 patchBuffer 전체로 통째로 교체한다.
// 교체 구간 길이가 원래 선택 구간과 다를 수 있으므로 전체 길이(duration)도 바뀐다.
export function replaceAudioSegment(
  baseBuffer: AudioBuffer,
  patchBuffer: AudioBuffer,
  startRatio: number,
  endRatio: number,
): AudioBuffer {
  const sampleRate = baseBuffer.sampleRate;
  const numChannels = baseBuffer.numberOfChannels;

  const baseLength = baseBuffer.length;
  const startSample = Math.floor(startRatio * baseLength);
  const endSample = Math.floor(endRatio * baseLength);

  // patchBuffer는 baseBuffer와 샘플레이트가 다를 수 있으므로
  // 길이를 baseBuffer 기준 샘플 수로 환산
  const patchSampleCount = Math.round(
    (patchBuffer.length / patchBuffer.sampleRate) * sampleRate,
  );

  const beforeLength = startSample;
  const afterLength = baseLength - endSample;
  const newLength = beforeLength + patchSampleCount + afterLength;

  const audioCtx = new OfflineAudioContext(
    numChannels,
    Math.max(newLength, 1),
    sampleRate,
  );
  const newBuffer = audioCtx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const baseData = baseBuffer.getChannelData(
      Math.min(ch, baseBuffer.numberOfChannels - 1),
    );
    const patchData = patchBuffer.getChannelData(
      Math.min(ch, patchBuffer.numberOfChannels - 1),
    );
    const out = newBuffer.getChannelData(ch);

    // 1) 교체 구간 이전 (그대로)
    out.set(baseData.subarray(0, beforeLength), 0);

    // 2) 패치 구간 — 샘플레이트가 다르면 선형 보간으로 리샘플링
    if (patchBuffer.sampleRate === sampleRate) {
      out.set(patchData.subarray(0, patchSampleCount), beforeLength);
    } else {
      const ratio = patchData.length / patchSampleCount;
      for (let i = 0; i < patchSampleCount; i++) {
        const srcIndex = i * ratio;
        const srcFloor = Math.floor(srcIndex);
        const srcCeil = Math.min(srcFloor + 1, patchData.length - 1);
        const frac = srcIndex - srcFloor;
        out[beforeLength + i] =
          patchData[srcFloor] * (1 - frac) + patchData[srcCeil] * frac;
      }
    }

    // 3) 교체 구간 이후 (그대로)
    out.set(baseData.subarray(endSample), beforeLength + patchSampleCount);
  }

  return newBuffer;
}

export function audioBufferDurationSec(buffer: AudioBuffer): number {
  return buffer.length / buffer.sampleRate;
}

export const MAX_HUMMING_SECONDS = 30;

// 타이머 지연이나 인코더 패딩이 있어도 저장되는 실제 샘플 수를 제한한다.
export function trimAudioBuffer(buffer: AudioBuffer, maxSeconds: number): AudioBuffer {
  const length = Math.floor(maxSeconds * buffer.sampleRate);
  if (length < 1) throw new Error("녹음 가능한 시간이 없습니다.");
  if (buffer.length <= length) return buffer;
  const trimmed = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.copyToChannel(buffer.getChannelData(channel).subarray(0, length), channel);
  }
  return trimmed;
}

// ── 실제 파형 추출 ───────────────────────────────────────────
// AudioBuffer를 barCount개 구간으로 나눠, 각 구간의 피크 진폭(0~100)을 뽑는다.
// Waveform 컴포넌트가 기대하는 bars 배열(0~100 범위) 포맷과 동일하게 반환.
export function audioBufferToBars(
  buffer: AudioBuffer,
  barCount = 256,
): number[] {
  if (!Number.isInteger(barCount) || barCount < 1) return [];
  const length = buffer.length;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, ch) =>
    buffer.getChannelData(ch),
  );
  const bars: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = Math.floor((i * length) / barCount);
    const end = Math.min(length, Math.max(start + 1, Math.floor(((i + 1) * length) / barCount)));

    let peak = 0;
    // 채널별 절댓값을 사용해 역위상 스테레오의 상쇄를 방지한다.
    for (const data of channels) {
      for (let j = start; j < end; j++) {
        peak = Math.max(peak, Math.abs(data[j]));
      }
    }

    // 무음은 0, 최대 진폭은 100으로 표시한다.
    const scaled = Math.min(100, peak * 100);
    bars.push(scaled);
  }

  return bars;
}

// AudioBuffer -> 16bit PCM WAV ArrayBuffer
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  // 채널 인터리빙
  const numFrames = buffer.length;
  const interleaved = new Float32Array(numFrames * numChannels);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < numFrames; i++) {
      interleaved[i * numChannels + channel] = channelData[i];
    }
  }

  const dataSize = interleaved.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF 헤더
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt 청크
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM 청크 크기
  view.setUint16(20, 1, true); // PCM 포맷
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data 청크
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // PCM 샘플 (float -> 16bit signed)
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return arrayBuffer;
}
