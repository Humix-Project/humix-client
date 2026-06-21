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

// ── 실제 파형 추출 ───────────────────────────────────────────
// AudioBuffer를 barCount개 구간으로 나눠, 각 구간의 피크 진폭(0~100)을 뽑는다.
// Waveform 컴포넌트가 기대하는 bars 배열(0~100 범위) 포맷과 동일하게 반환.
export function audioBufferToBars(
  buffer: AudioBuffer,
  barCount = 80,
): number[] {
  // 채널이 여러 개면 평균내서 모노로 합침
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const merged = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      merged[i] += data[i] / numChannels;
    }
  }

  const samplesPerBar = Math.max(1, Math.floor(length / barCount));
  const bars: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = i === barCount - 1 ? length : start + samplesPerBar;

    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(merged[j]);
      if (abs > peak) peak = abs;
    }

    // 0~1 범위의 진폭을 15~100 범위로 매핑 (기존 makeWave와 동일한 시각적 최소 높이 유지)
    const scaled = Math.min(100, 15 + peak * 85);
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
