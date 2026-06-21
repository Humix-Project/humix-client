import { useState, useRef } from "react";
import Stepper from "../components/Stepper";
import { useNavigate } from "react-router-dom";
import { useHummingStore } from "../store/useHummingStore"; // ◀ 경로는 실제 프로젝트 구조에 맞게 조정
import { useAuthStore } from "../store/useAuthStore"; // ◀ 게스트 로그인 토큰 보관 store
import {
  webmBlobToWavBlob,
  blobToAudioBuffer,
  replaceAudioSegment,
  audioBufferDurationSec,
  audioBufferToWav,
  audioBufferToBars,
} from "../utils/audioUtils"; // ◀ 경로는 실제 프로젝트 구조에 맞게 조정

// ── 타입 ──────────────────────────────────────────────────────
type RecordingVersion = {
  id: number;
  bars: number[]; // 전체 파형 (80개 bar, 시각화용)
  durationSec: number; // 실제 녹음 초
  label: string; // "원본" | "재녹음 1" | "재녹음 2" ...
  blob: Blob; // ◀ 실제 녹음된 오디오 (webm)
  patchStart?: number;
  patchEnd?: number;
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

// ── Waveform 컴포넌트 (기존과 동일) ────────────────────────────
function Waveform({
  bars,
  height = 40,
  selectedRange,
  onSelect,
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
  const navigate = useNavigate();
  const setHumming = useHummingStore((s) => s.setHumming); // ◀ humming_id 저장용

  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>(Array(80).fill(5));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [versions, setVersions] = useState<RecordingVersion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 재녹음 상태
  const [patchTarget, setPatchTarget] = useState<number | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [patchRecording, setPatchRecording] = useState(false);
  const [patchElapsed, setPatchElapsed] = useState(0);
  const patchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 재생
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<Map<number, string>>(new Map());

  // 업로드 진행 상태
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── MediaRecorder 관련 ref (전체 녹음) ──────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // ── MediaRecorder 관련 ref (구간 재녹음) ─────────────────────
  const patchRecorderRef = useRef<MediaRecorder | null>(null);
  const patchChunksRef = useRef<Blob[]>([]);
  const patchStreamRef = useRef<MediaStream | null>(null);
  const [isPatchProcessing, setIsPatchProcessing] = useState(false);

  // ── 전체 녹음 시작 ───────────────────────────────────────────
  async function startRecording() {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorder.start();

      if (timerRef.current) clearInterval(timerRef.current);
      setRecordState("recording");
      setElapsed(0);
      setLiveBars(Array(80).fill(5));
      let sec = 0;
      timerRef.current = setInterval(() => {
        sec++;
        setElapsed(sec);
        setLiveBars(makeWave(80)); // 실시간 파형은 시각 효과용 (실제 진폭 분석 아님)
        if (sec >= 60) stopRecording(sec);
      }, 1000);
    } catch (err) {
      console.error("마이크 접근 실패:", err);
      setUploadError(
        "마이크 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.",
      );
    }
  }

  // ── 전체 녹음 종료 ───────────────────────────────────────────
  function stopRecording(finalSec?: number) {
    if (timerRef.current) clearInterval(timerRef.current);

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    const dur = finalSec ?? elapsed;

    mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(recordedChunksRef.current, {
        type: "audio/webm",
      });

      // 실제 녹음된 오디오의 진폭을 분석해 파형을 그림 (실패 시 임의 파형으로 폴백)
      let bars: number[];
      try {
        const audioBuffer = await blobToAudioBuffer(webmBlob);
        bars = audioBufferToBars(audioBuffer, 80);
      } catch (err) {
        console.error("파형 분석 실패, 임의 파형으로 대체:", err);
        bars = makeWave(80);
      }

      const newVer: RecordingVersion = {
        id: Date.now(),
        bars,
        durationSec: dur || 1,
        label: versions.length === 0 ? "원본" : `재녹음 ${versions.length}`,
        blob: webmBlob,
      };
      setVersions((prev) => [...prev, newVer]);
      setSelectedId(newVer.id);
      setRecordState("done");
      setSelection(null);
      setPatchTarget(null);

      // 마이크 스트림 정리
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    mediaRecorder.stop();
  }

  function handleMicClick() {
    if (recordState === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // ── 구간 재녹음 시작: 실제 마이크 녹음 시작 ──────────────────
  async function startPatchRecord(versionId: number) {
    if (!selection || selection[1] - selection[0] < 0.02) return;

    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      patchStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      patchRecorderRef.current = recorder;
      patchChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) patchChunksRef.current.push(e.data);
      };

      recorder.start();

      setPatchTarget(versionId);
      setPatchRecording(true);
      setPatchElapsed(0);
      let sec = 0;
      patchTimerRef.current = setInterval(() => {
        sec++;
        setPatchElapsed(sec);
      }, 1000);
    } catch (err) {
      console.error("마이크 접근 실패:", err);
      setUploadError(
        "마이크 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.",
      );
    }
  }

  // ── 구간 재녹음 종료: 새 녹음을 원본의 선택 구간에 실제로 합성 ──
  function stopPatchRecord(versionId: number) {
    if (patchTimerRef.current) clearInterval(patchTimerRef.current);
    setPatchRecording(false);

    const recorder = patchRecorderRef.current;
    if (!recorder || !selection) {
      patchStreamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }

    recorder.onstop = async () => {
      patchStreamRef.current?.getTracks().forEach((t) => t.stop());
      patchStreamRef.current = null;

      const patchBlob = new Blob(patchChunksRef.current, {
        type: "audio/webm",
      });

      setIsPatchProcessing(true);
      setUploadError(null);

      try {
        const base = versions.find((v) => v.id === versionId);
        if (!base) return;

        // 원본 오디오와 새로 녹음한 패치 오디오를 둘 다 디코딩
        const [baseBuffer, patchBuffer] = await Promise.all([
          blobToAudioBuffer(base.blob),
          blobToAudioBuffer(patchBlob),
        ]);

        // 선택 구간([selection[0], selection[1]])을 새 녹음으로 실제 교체
        const mergedBuffer = replaceAudioSegment(
          baseBuffer,
          patchBuffer,
          selection[0],
          selection[1],
        );

        const mergedWavBlob = new Blob([audioBufferToWav(mergedBuffer)], {
          type: "audio/wav",
        });
        const newDurationSec = audioBufferDurationSec(mergedBuffer);

        // 합성된 실제 오디오에서 파형 추출 (patchStart~patchEnd 표시는 비율 기준이라
        // 길이가 바뀌어도 동일한 selection 비율을 그대로 사용)
        const newBars = audioBufferToBars(mergedBuffer, 80);

        const newVer: RecordingVersion = {
          id: Date.now(),
          bars: newBars,
          durationSec: newDurationSec,
          label: `재녹음 ${versions.length}`,
          blob: mergedWavBlob,
          patchStart: selection[0],
          patchEnd: selection[1],
        };

        setVersions((prev) => [...prev, newVer]);
        setSelectedId(newVer.id);
      } catch (err) {
        console.error("구간 재녹음 합성 실패:", err);
        setUploadError("구간 재녹음을 합치는 중 오류가 발생했습니다.");
      } finally {
        setIsPatchProcessing(false);
        setSelection(null);
        setPatchTarget(null);
      }
    };

    recorder.stop();
  }

  // ── 들어보기 (재생) ──────────────────────────────────────────
  function handlePlay(ver: RecordingVersion) {
    if (playingId === ver.id) {
      audioElRef.current?.pause();
      setPlayingId(null);
      return;
    }

    let url = objectUrlsRef.current.get(ver.id);
    if (!url) {
      url = URL.createObjectURL(ver.blob);
      objectUrlsRef.current.set(ver.id, url);
    }

    if (!audioElRef.current) {
      audioElRef.current = new Audio();
      audioElRef.current.onended = () => setPlayingId(null);
    }
    audioElRef.current.src = url;
    audioElRef.current.play();
    setPlayingId(ver.id);
  }

  // ── API 제출: presigned URL 발급 → S3 업로드 → DB 저장 ────────
  async function handleNext() {
    if (!selectedId) return;
    const ver = versions.find((v) => v.id === selectedId);
    if (!ver) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        throw new Error("로그인이 필요합니다.");
      }

      // 1) 업로드용 wav 변환 (API 3.4.1.3 비고: mp3/wav만 취급)
      //    구간 재녹음으로 만들어진 버전은 이미 wav이므로 그대로 사용,
      //    최초 전체 녹음(webm)인 경우에만 변환 수행
      const wavBlob =
        ver.blob.type === "audio/wav"
          ? ver.blob
          : await webmBlobToWavBlob(ver.blob);
      const audioName = `${ver.label}_${Date.now()}.wav`;

      // 2) Presigned URL 발급 — 3.4.1.3
      //    ⚠️ 실측 결과 명세서(PDF)와 달리 이 API도 로그인(Authorization) 필요함
      const presignedRes = await fetch("/api/v1/upload/audio/presigned", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          audio_name: audioName,
          content_type: "audio/wav",
          usage: "HUMMING",
        }),
      });
      if (!presignedRes.ok) {
        const errBody = await presignedRes.text().catch(() => "");
        throw new Error(
          `presigned URL 발급 실패 (${presignedRes.status})${errBody ? `: ${errBody}` : ""}`,
        );
      }
      // ⚠️ 실측 결과 응답은 { isSuccess, code, message, result } Envelope이며
      // 실제 데이터는 result 안에 있음 (PDF 명세서의 data 키가 아님)
      const presignedJson = await presignedRes.json();
      const { presigned_url, file_key } = presignedJson.result;

      // 3) S3에 실제 파일 업로드 — 3.4.3.1 (FormData로 감싸지 않고 바이너리 그대로 전송)
      const s3Res = await fetch(presigned_url, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: wavBlob,
      });
      if (!s3Res.ok) {
        const errBody = await s3Res.text().catch(() => "");
        throw new Error(
          `S3 업로드 실패 (${s3Res.status})${errBody ? `: ${errBody}` : ""}`,
        );
      }

      // 4) 백엔드에 허밍 정보 저장 → humming_id 발급 — 3.4.1.4
      const saveRes = await fetch("/api/v1/upload/humming", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          file_key,
          duration_seconds: ver.durationSec,
        }),
      });
      if (!saveRes.ok) {
        const errBody = await saveRes.text().catch(() => "");
        throw new Error(
          `허밍 저장 실패 (${saveRes.status})${errBody ? `: ${errBody}` : ""}`,
        );
      }
      // ⚠️ 실측 결과 응답은 { isSuccess, code, message, result } Envelope
      const saveJson = await saveRes.json();
      const saveData = saveJson.result;
      // saveData: { humming_id, file_url, duration_seconds, created_at }

      // 5) zustand에 humming_id 저장 — 다음 단계(멜로디 벡터 변환)에서 사용
      setHumming({
        hummingId: saveData.humming_id,
        fileUrl: saveData.file_url,
        durationSeconds: saveData.duration_seconds,
      });

      // 6) 멜로디 벡터 페이지로 이동
      //    실제 벡터 변환(POST /hummings/{humming_id}/vectors) 호출은
      //    MelodyEdit 페이지 진입 시 humming_id를 store에서 꺼내 호출하는 편이
      //    책임 분리상 깔끔합니다. (로딩 화면에서 호출해도 무방)
      navigate("/MelodyEdit");
    } catch (err) {
      console.error(err);
      setUploadError(
        err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const hasVersions = versions.length > 0;
  const selectedVer = versions.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white flex flex-col">
      {/* ── Stepper 헤더 ── */}
      <div
        className=" ml-12 mr-12 border-b px-8 py-4 flex items-center gap-8"
        style={{ background: "#1A1D24", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex-1 flex justify-center">
          <Stepper currentStep={1} />
        </div>
        <div className="w-24 shrink-0" />
      </div>

      <div className="mb-1 ml-12 mt-10 flex flex-col gap-5">
        <div>
          <h1 className=" text-2xl font-bold text-white mb-2">허밍 녹음</h1>
          <p className="text-sm text-gray-500">
            떠오르는 음을 마이크에 허밍으로 녹음해보세요. 최대 60초까지 녹음할
            수 있습니다.
          </p>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center  py-6 w-full max-w-6xl mx-auto">
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
                    ? "linear-gradient(135deg, #6366f1, #7c3aed)"
                    : "linear-gradient(135deg, #7c3aed, #a855f7)",
              boxShadow:
                recordState === "recording"
                  ? "0 0 0 0 rgba(236,72,153,0.4), 0 0 40px rgba(168,85,247,0.5)"
                  : recordState === "done"
                    ? "0 0 30px rgba(124,58,237,0.45)"
                    : "0 0 24px rgba(139,92,246,0.35)",
              animation:
                recordState === "recording"
                  ? "micPulse 1.4s ease-in-out infinite"
                  : "none",
            }}
          >
            {recordState === "recording" ? (
              <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
                <rect x="6" y="6" width="12" height="12" rx="2.5" />
              </svg>
            ) : recordState === "done" ? (
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

        {/* ── 업로드 에러 표시 ── */}
        {uploadError && (
          <div
            className="w-full rounded-xl px-4 py-3 mt-4 text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171",
            }}
          >
            {uploadError}
          </div>
        )}

        {/* ── 버전 목록 ── */}
        {hasVersions && (
          <div
            className="w-full rounded-2xl p-6 flex flex-col gap-3 mt-4"
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
                  <div className="flex items-center gap-3 px-4 py-3">
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

                    <button
                      onClick={() => handlePlay(ver)}
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
                            !selection ||
                            selection[1] - selection[0] < 0.02 ||
                            isPatchProcessing
                          }
                          className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: "hsl(288, 71%, 73%)",
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
                          {isPatchProcessing
                            ? "구간 합성 중..."
                            : "선택 구간 재녹음 시작"}
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
            disabled={isUploading}
            className="w-full py-3.5 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-95
            bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/30 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-4"
          >
            {isUploading ? (
              "업로드 중..."
            ) : (
              <>
                다음 단계: 멜로디 편집 → &nbsp;
                <span className="opacity-60 font-normal">
                  ({selectedVer.label} 선택됨)
                </span>
              </>
            )}
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
