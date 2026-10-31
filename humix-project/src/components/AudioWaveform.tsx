import { useEffect, useState } from "react";
import { audioBufferToBars, blobToAudioBuffer } from "../utils/audioUtils";

export default function AudioWaveform({ src, muted = false, barCount = 256 }: { src?: string; muted?: boolean; barCount?: number }) {
  const [result, setResult] = useState<{ src: string; bars?: number[]; error?: boolean } | null>(null);

  useEffect(() => {
    if (!src) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(src!, { signal: controller.signal });
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        const buffer = await blobToAudioBuffer(await response.blob());
        if (!controller.signal.aborted) setResult({ src: src!, bars: audioBufferToBars(buffer, barCount) });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("파형 분석 실패:", error);
          setResult({ src: src!, error: true });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [src, barCount]);

  const current = result?.src === src ? result : null;
  if (!current?.bars) {
    return <span className="m-auto text-xs text-gray-500" role="status">
      {!src ? "오디오가 없습니다" : current?.error ? "파형을 불러오지 못했습니다" : "파형 분석 중…"}
    </span>;
  }
  return <div className="flex h-full w-full items-center" role="img" aria-label="실제 오디오 파형">
    {current.bars.map((height, index) => <div
      key={index}
      className={`flex-1 min-w-0 ${muted ? "bg-gray-700" : "bg-gradient-to-t from-[#8B5CF6] to-pink-400"}`}
      style={{ height: `${height}%`, minHeight: 1 }}
    />)}
  </div>;
}
