import { useState, useRef } from "react";
import Stepper from "../components/Stepper";

// ── 타입 ──────────────────────────────────────────────────────
type RecordingVersion = {
  id: number;
  bars: number[]; // 전체 파형 (80개 bar)
  durationSec: number; // 실제 녹음 초
  label: string; // "원본" | "재녹음 1" | "재녹음 2" ...
  patchStart?: number; // 재녹음 시작 비율 (0~1)
  patchEnd?: number; // 재녹음 종료 비율 (0~1)
};

type RecordState = "idle" | "recording" | "patching" | "done";

// ── 헬퍼 ──────────────────────────────────────────────────────
function makeWave(count = 80): number[] {
  return Array.from({ length: count }, () => 15 + Math.random() * 85);
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Waveform 컴포넌트 ─────────────────────────────────────────
function Waveform({
  bars,
  height = 40,
  selectedRange, // [startRatio, endRatio] 0~1
  onSelect, // 드래그 선택 콜백
  accent = "#8b5cf6",
  patchStart,
  patchEnd,
}: {
  bars: number[];
  height?: number;
  selectedRange?: [number, number] | null;
  onSelect?: (start: number, end: number) => void;
  accent?: string;
  patchStart?: number;
  patchEnd?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef(0);

  const getRatio = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onSelect) return;
    dragging.current = true;
    dragStart.current = getRatio(e);
    onSelect(dragStart.current, dragStart.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current || !onSelect) return;
    const cur = getRatio(e);
    const [a, b] = [
      Math.min(dragStart.current, cur),
      Math.max(dragStart.current, cur),
    ];
    onSelect(a, b);
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 overflow-hidden rounded-lg select-none"
      style={{ height, cursor: onSelect ? "crosshair" : "default", flex: 1 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {bars.map((h, i) => {
        const ratio = i / bars.length;
        const inPatch =
          patchStart !== undefined &&
          patchEnd !== undefined &&
          ratio >= patchStart &&
          ratio <= patchEnd;
        const inSel =
          selectedRange &&
          ratio >= selectedRange[0] &&
          ratio <= selectedRange[1];
        return (
          <div
            key={i}
            className="rounded-sm shrink-0 transition-all duration-75"
            style={{
              width: "3px",
              height: `${(h / 100) * height}px`,
              background: inPatch ? "#f472b6" : inSel ? "#e879f9" : accent,
              opacity: inPatch || inSel ? 1 : 0.75,
            }}
          />
        );
      })}
      {/* 선택 영역 오버레이 */}
      {selectedRange && selectedRange[1] - selectedRange[0] > 0.01 && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none rounded"
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

// ── 메인 페이지 ───────────────────────────────────────────────
export default function CreateMusic() {
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>(Array(80).fill(5));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [versions, setVersions] = useState<RecordingVersion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 재녹음 상태
  const [patchTarget, setPatchTarget] = useState<number | null>(null); // 어떤 버전을 패치할지
  const [selection, setSelection] = useState<[number, number] | null>(null); // 드래그 선택
  const [patchRecording, setPatchRecording] = useState(false);
  const [patchElapsed, setPatchElapsed] = useState(0);
  const patchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 재생 중인 버전
  const [playingId, setPlayingId] = useState<number | null>(null);

  // ── 전체 녹음 ─────────────────────────────────────────────
  function startRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordState("recording");
    setElapsed(0);
    setLiveBars(Array(80).fill(5));
    let sec = 0;
    timerRef.current = setInterval(() => {
      sec++;
      setElapsed(sec);
      setLiveBars(makeWave(80));
      if (sec >= 60) stopRecording(sec);
    }, 1000);
  }

  function stopRecording(finalSec?: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    const dur = finalSec ?? elapsed;
    const newVer: RecordingVersion = {
      id: Date.now(),
      bars: makeWave(80),
      durationSec: dur || 8,
      label: versions.length === 0 ? "원본" : `재녹음 ${versions.length}`,
    };
    setVersions((prev) => [...prev, newVer]);
    setSelectedId(newVer.id);
    setRecordState("done");
    setSelection(null);
    setPatchTarget(null);
  }

  function handleMicClick() {
    if (recordState === "recording") {
      stopRecording();
    } else {
      // 전체 재녹음 (이전 버전 히스토리 유지, 새 버전 추가)
      startRecording();
      setRecordState("recording");
    }
  }

  // ── 구간 재녹음 ───────────────────────────────────────────
  function startPatchRecord(versionId: number) {
    if (!selection || selection[1] - selection[0] < 0.02) return;
    setPatchTarget(versionId);
    setPatchRecording(true);
    setPatchElapsed(0);
    let sec = 0;
    patchTimerRef.current = setInterval(() => {
      sec++;
      setPatchElapsed(sec);
    }, 1000);
  }

  function stopPatchRecord(versionId: number) {
    if (patchTimerRef.current) clearInterval(patchTimerRef.current);
    setPatchRecording(false);

    // 해당 버전의 파형에서 선택 구간 bars를 새로 교체 → 새 버전으로 저장
    setVersions((prev) => {
      const base = prev.find((v) => v.id === versionId);
      if (!base || !selection) return prev;
      const newBars = base.bars.map((h, i) => {
        const ratio = i / base.bars.length;
        if (ratio >= selection[0] && ratio <= selection[1]) {
          return 15 + Math.random() * 85; // 패치 구간만 새 파형
        }
        return h;
      });
      const newVer: RecordingVersion = {
        id: Date.now(),
        bars: newBars,
        durationSec: base.durationSec,
        label: `재녹음 ${prev.length}`,
        patchStart: selection[0],
        patchEnd: selection[1],
      };
      return [...prev, newVer];
    });
    setVersions((prev) => {
      const newId = prev[prev.length - 1]?.id;
      if (newId) setSelectedId(newId);
      return prev;
    });
    setSelection(null);
    setPatchTarget(null);
  }

  // ── API 제출 ──────────────────────────────────────────────
  async function handleNext() {
    if (!selectedId) return;
    const ver = versions.find((v) => v.id === selectedId);
    if (!ver) return;
    // 실제 구현 시 FormData로 오디오 파일 업로드 후 file_key 획득
    const body = {
      file_key: `uploads/humming/${Date.now()}_user_humming.mp3`,
      audio_name: `${ver.label}.mp3`,
      duration_seconds: ver.durationSec,
    };
    console.log("POST /api/v1/upload/humming", body);
    // const res = await fetch("/api/v1/upload/humming", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(body),
    // });
    // const { humming_id } = await res.json();
    alert(`다음 단계로 이동 (humming_id: mock_${selectedId})`);
  }

  const hasVersions = versions.length > 0;
  const selectedVer = versions.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white flex flex-col">
      {/* ── Stepper 헤더 ── */}
      <div
        className="w-full border-b px-8 py-4 flex items-center gap-8"
        style={{ background: "#1A1D24", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <span className="text-sm font-semibold text-white shrink-0">
          허밍 녹음
        </span>
        <div className="flex-1 flex justify-center">
          <Stepper currentStep={1} />
        </div>
        <div className="w-24 shrink-0" />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-8 w-full max-w-4xl mx-auto gap-5">
        {/* ── 녹음 카드 ── */}
        <div
          className="w-full rounded-2xl p-8 flex flex-col items-center gap-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* 마이크 버튼 */}
          <button
            onClick={handleMicClick}
            className="relative flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              width: "112px",
              height: "112px",
              borderRadius: "50%",
              background:
                recordState === "recording"
                  ? "linear-gradient(135deg, #ec4899, #a855f7)"
                  : recordState === "done"
                    ? "linear-gradient(135deg, #6366f1, #7c3aed)" // ◀ 완료 시 세련된 보라색 그라디언트로 변경
                    : "linear-gradient(135deg, #7c3aed, #a855f7)",
              boxShadow:
                recordState === "recording"
                  ? "0 0 0 0 rgba(236,72,153,0.4), 0 0 40px rgba(168,85,247,0.5)"
                  : recordState === "done"
                    ? "0 0 30px rgba(124,58,237,0.45)" // ◀ 보라색 네온 글로우 효과 반영
                    : "0 0 24px rgba(139,92,246,0.35)",
              animation:
                recordState === "recording"
                  ? "micPulse 1.4s ease-in-out infinite"
                  : "none",
            }}
          >
            {recordState === "recording" ? (
              /* 정지 아이콘 */
              <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
                <rect x="6" y="6" width="12" height="12" rx="2.5" />
              </svg>
            ) : recordState === "done" ? (
              /* 재녹음 아이콘 (보라색 톤에 맞춰 화이트 마이크 스타일 유지) */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="40"
                height="40"
              >
                <path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
                  fill="white"
                />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            ) : (
              /* 마이크 아이콘 */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="44"
                height="44"
              >
                <path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
                  fill="rgba(255,255,255,0.9)"
                />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            )}
          </button>

          {/* 상태 / 타이머 */}
          <div className="flex flex-col items-center gap-1">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{
                color:
                  recordState === "recording"
                    ? "#f472b6"
                    : recordState === "done"
                      ? "#8B5CF6"
                      : "rgba(255,255,255,0.45)",
              }}
            >
              {recordState === "recording"
                ? "● 녹음 중"
                : recordState === "done"
                  ? "✓ 녹음 완료"
                  : "녹음 시작하려면 클릭"}
            </span>
            <span
              className="font-black tabular-nums"
              style={{
                fontSize: "3rem",
                letterSpacing: "-0.04em",
                color:
                  recordState === "recording"
                    ? "#f9a8d4"
                    : "rgba(255,255,255,0.8)",
              }}
            >
              {fmtSec(elapsed)}
            </span>
            <p
              className="text-xs mt-0.5"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              3초 이상 조용한 환경에서 일정한 음정으로 녹음해주세요!
            </p>
          </div>

          {/* 실시간 파형 */}
          <div className="w-full">
            <div className="flex justify-between mb-1.5">
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                실시간 파형
              </span>
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                SNR &gt; 10dB
              </span>
            </div>
            <div
              className="w-full rounded-xl px-4 flex items-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                height: "52px",
              }}
            >
              <Waveform
                bars={
                  recordState === "recording" ? liveBars : Array(80).fill(4)
                }
                accent={
                  recordState === "recording"
                    ? "#a855f7"
                    : "rgba(139,92,246,0.25)"
                }
                height={36}
              />
            </div>
          </div>
        </div>

        {/* ── 버전 목록 ── */}
        {hasVersions && (
          <div
            className="w-full rounded-2xl p-6 flex flex-col gap-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="text-base font-bold text-white">녹음된 구간</h3>
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                (파형 드래그 → 구간 선택 → 재녹음)
              </span>
            </div>

            {versions.map((ver) => {
              const isSelected = selectedId === ver.id;
              const isPatching = patchTarget === ver.id;
              const isPlaying = playingId === ver.id;

              return (
                <div
                  key={ver.id}
                  className="rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    border: isSelected
                      ? "1px solid rgba(139,92,246,0.55)"
                      : "1px solid rgba(255,255,255,0.07)",
                    background: isSelected
                      ? "rgba(139,92,246,0.08)"
                      : "rgba(255,255,255,0.03)",
                  }}
                >
                  {/* 메인 행 */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* 선택 라디오 */}
                    <button
                      onClick={() => setSelectedId(ver.id)}
                      className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: isSelected
                          ? "#a855f7"
                          : "rgba(255,255,255,0.2)",
                        background: isSelected ? "#a855f7" : "transparent",
                      }}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </button>

                    {/* 라벨 */}
                    <span
                      className="text-xs font-semibold shrink-0 w-16"
                      style={{
                        color: isSelected
                          ? "#c084fc"
                          : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {ver.label}
                    </span>

                    {/* 파형 (드래그 선택 가능) */}
                    <Waveform
                      bars={ver.bars}
                      height={36}
                      accent={isSelected ? "#8b5cf6" : "#4b4b6b"}
                      selectedRange={isPatching ? selection : null}
                      onSelect={
                        isPatching ? (a, b) => setSelection([a, b]) : undefined
                      }
                      patchStart={ver.patchStart}
                      patchEnd={ver.patchEnd}
                    />

                    {/* 시간 */}
                    <span
                      className="text-xs tabular-nums shrink-0"
                      style={{
                        color: "rgba(255,255,255,0.45)",
                        minWidth: "32px",
                        textAlign: "right",
                      }}
                    >
                      {fmtSec(ver.durationSec)}
                    </span>

                    {/* 들어보기 */}
                    <button
                      onClick={() => setPlayingId(isPlaying ? null : ver.id)}
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{
                        background: isPlaying
                          ? "linear-gradient(135deg,#a855f7,#ec4899)"
                          : "rgba(255,255,255,0.08)",
                        fontSize: "10px",
                        color: "white",
                      }}
                    >
                      {isPlaying ? "⏸" : "▶"}
                    </button>

                    {/* 재녹음 버튼 */}
                    {!isPatching ? (
                      <button
                        onClick={() => {
                          setPatchTarget(ver.id);
                          setSelection(null);
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{
                          background: "rgba(139,92,246,0.15)",
                          color: "#a78bfa",
                          border: "1px solid rgba(139,92,246,0.3)",
                        }}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          width="11"
                          height="11"
                        >
                          <path
                            d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M13.5 2.5v3h-3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        재녹음
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setPatchTarget(null);
                          setSelection(null);
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          color: "rgba(255,255,255,0.45)",
                        }}
                      >
                        취소
                      </button>
                    )}
                  </div>

                  {/* 구간 재녹음 패널 */}
                  {isPatching && (
                    <div
                      className="px-4 pb-4 pt-1 flex flex-col gap-3"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        위 파형에서 마우스로 드래그해 교체할 구간을 선택하세요.
                        {selection && selection[1] - selection[0] > 0.01 && (
                          <span style={{ color: "#e879f9" }}>
                            &nbsp;선택됨:{" "}
                            {fmtSec(Math.round(selection[0] * ver.durationSec))}{" "}
                            ~{" "}
                            {fmtSec(Math.round(selection[1] * ver.durationSec))}
                          </span>
                        )}
                      </p>

                      {!patchRecording ? (
                        <button
                          onClick={() => startPatchRecord(ver.id)}
                          disabled={
                            !selection || selection[1] - selection[0] < 0.02
                          }
                          className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background:
                              "linear-gradient(135deg,#ec4899,#a855f7)",
                            color: "white",
                            boxShadow: "0 2px 16px rgba(236,72,153,0.3)",
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="white"
                            width="14"
                            height="14"
                          >
                            <circle cx="12" cy="12" r="8" />
                          </svg>
                          선택 구간 재녹음 시작
                        </button>
                      ) : (
                        <button
                          onClick={() => stopPatchRecord(ver.id)}
                          className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95"
                          style={{
                            background: "rgba(239,68,68,0.2)",
                            color: "#f87171",
                            border: "1px solid rgba(239,68,68,0.35)",
                          }}
                        >
                          ■ 재녹음 중지 ({fmtSec(patchElapsed)})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 다음 단계 버튼 ── */}
        {selectedVer && (
          <button
            onClick={handleNext}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.01] active:scale-95"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              boxShadow: "0 4px 24px rgba(139,92,246,0.4)",
            }}
          >
            다음 단계: 멜로디 편집 → &nbsp;
            <span className="opacity-60 font-normal">
              ({selectedVer.label} 선택됨)
            </span>
          </button>
        )}
      </div>

      <style>{`
        @keyframes micPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(236,72,153,0.5), 0 0 40px rgba(168,85,247,0.4); }
          50% { box-shadow: 0 0 0 14px rgba(236,72,153,0), 0 0 40px rgba(168,85,247,0.4); }
        }
      `}</style>
    </div>
  );
}
