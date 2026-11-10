import { useEffect, useState } from "react";
import { audioBufferToBars, blobToAudioBuffer } from "../utils/audioUtils";

interface AudioWaveformProps {
  src?: string;
  muted?: boolean;
  barCount?: number;
  /** 녹음하기 페이지의 단색 막대 및 분홍색 선택 구간 스타일 */
  recordingStyle?: boolean;
  height?: number;
  selectedRange?: [number, number] | null;
}

export default function AudioWaveform({
  src,
  muted = false,
  barCount = 256,
  recordingStyle = false,
  height = 40,
  selectedRange = null,
}: AudioWaveformProps) {
  const [result, setResult] = useState<{ src: string; bars?: number[]; error?: boolean } | null>(null);

  useEffect(() => {
    if (!src) return;
    const controller = new AbortController();
    const url = src;

    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        const buffer = await blobToAudioBuffer(await response.blob());
        if (!controller.signal.aborted) {
          setResult({ src: url, bars: audioBufferToBars(buffer, barCount) });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("파형 분석 실패:", error);
          setResult({ src: url, error: true });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [src, barCount]);

  const current = result?.src === src ? result : null;
  if (!current?.bars) {
    return (
      <span className="m-auto text-xs text-gray-500" role="status">
        {!src ? "오디오가 없습니다" : current?.error ? "파형을 불러오지 못했습니다" : "파형 분석 중…"}
      </span>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center overflow-hidden rounded-lg select-none" role="img" aria-label="실제 오디오 파형">
      {current.bars.map((level, index) => {
        // 녹음하기(CreateMusic)의 Waveform과 동일한 선택 색상과 막대 높이 계산
        const ratio = index / current.bars!.length;
        const inSelection = recordingStyle && selectedRange &&
          ratio >= selectedRange[0] && ratio <= selectedRange[1];

        return (
          <div
            key={index}
            className={recordingStyle
              ? "flex-1 min-w-0 rounded-sm"
              : `flex-1 min-w-0 ${muted ? "bg-gray-700" : "bg-gradient-to-t from-[#8B5CF6] to-pink-400"}`
            }
            style={recordingStyle
              ? {
                  height: `${Math.max(1, (level / 100) * height)}px`,
                  background: inSelection ? "#e879f9" : muted ? "#4b4b6b" : "#8b5cf6",
                  opacity: inSelection ? 1 : 0.75,
                }
              : { height: `${level}%`, minHeight: 1 }
            }
          />
        );
      })}

      {recordingStyle && selectedRange && selectedRange[1] - selectedRange[0] > 0.01 && (
        <div
          className="absolute inset-y-0 pointer-events-none rounded"
          style={{
            left: `${selectedRange[0] * 100}%`,
            width: `${(selectedRange[1] - selectedRange[0]) * 100}%`,
            background: "rgba(232,121,249,0.15)",
            border: "1px solid rgba(232,121,249,0.5)",
          }}
        />
      )}
    </div>
  );
}
