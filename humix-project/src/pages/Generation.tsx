/**
 * Generation.tsx
 *
 * [Step 5] AI 곡 완성 페이지
 * 생성 설정 요약을 확인하고 AI 음악 생성 결과를 보여주는 UI 컴포넌트
 *
 * ─────────────────────────────────────────────
 * TODO: API 연결 포인트 요약 (HuMix_API.pdf 기준)
 * ─────────────────────────────────────────────
 * [API-1] 곡 생성 요청 (비동기)
 * POST /api/v1/generation/songs
 * Body: { humming_id, title, genre, mood, prompt?, reference_track_id }
 * → task_id 반환
 *
 * [API-2] 생성 진행률 실시간 구독 (SSE)
 * GET /api/v1/generation/songs/tasks/{task_id}/stream
 * Headers: Accept: text/event-stream
 * → event: progress / complete 수신
 * → complete 시 audio_url, song_id 포함
 * ─────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { generationRequest, validateModification, revertMessage } from "../utils/generationHistory";
import type { SongVersion, VersionHistory } from "../utils/generationHistory";
import Stepper from "../components/Stepper";
import DownloadModal from "../components/DownloadModal";
// 🔌 API 연결: EventSource는 Authorization 등 커스텀 헤더를 지정할 수 없어
//             fetch 기반으로 헤더를 자유롭게 설정 가능한 라이브러리로 교체 (명세서 비고: "헤더 수정 불가 시 외부 라이브러리 사용" 지침 반영)
//             설치: npm install @microsoft/fetch-event-source
import { fetchEventSource } from "@microsoft/fetch-event-source";
// 🔌 API 연결: 로그인(게스트) 시 발급받은 access_token을 가져오기 위해 auth 스토어 연결
import { useAuthStore } from "../store/useAuthStore";
// 🔌 API 연결: 장르/분위기 선택값을 가져오기 위해 concept 스토어 연결
import { useConceptStore } from "../store/useConceptStore";
// 🔌 API 연결: 허밍 녹음 단계에서 저장된 humming_id를 가져오기 위해 humming 스토어 연결
import { useHummingStore } from "../store/useHummingStore";

// ── 생성 설정 요약 타입 ────────────────────────────────────────────────────
// TODO: 실제 연결 시 Zustand store에서 가져오도록 교체
// import { useStore } from '../store/useStore';
interface SummaryItem {
  icon: string;
  label: string;
  value: string;
}

// ── 임시 더미 데이터 (API 연결 전 UI 확인용) ──────────────────────────────
// TODO: 실제 연결 시 아래 더미 데이터를 Zustand store 값으로 교체
// const { hummingDuration, melodyVectors, genre, moods, referenceTrackId } = useStore();
const DUMMY_SUMMARY: SummaryItem[] = [
  {
    icon: "🎤",
    label: "허밍 녹음",
    value: "완료 (8.0s)",
  },
  {
    icon: "🎼",
    label: "멜로디 벡터",
    value: "6개 노트 추출",
  },
  {
    icon: "🎸",
    label: "장르",
    value: "K-POP",
  },
  {
    icon: "🌤",
    label: "분위기",
    value: "밝고 신나는",
  },
  {
    icon: "🎵",
    label: "스타일 참조",
    // TODO: referenceTrackId가 null이면 '선택 없음' 표시
    value: "선택 없음",
  },
];

// ── 생성 상태 타입 ────────────────────────────────────────────────────────
type GenerationStatus = "idle" | "generating" | "done" | "error";

// ── 수정 버전 타입 ────────────────────────────────────────────────────────
// AI로 수정하기 패널에서 생성되는 각 수정 버전
interface ModVersion extends SongVersion {
  isActive: boolean;
}

// 🔌 API 연결: API 응답 Envelope 공통 타입 (백엔드 실제 응답 기준 result로 통일)
interface ApiEnvelope<T> {
  code: string;
  message: string;
  result: T; // ← data → result (백엔드 실제 응답 envelope 기준)
}

// 🔌 API 연결: [API-1] 곡 생성 요청 응답 타입 (API 명세서 3.4.1.8)
interface GenerationTaskResponse {
  task_id: string;
}

// 🔌 API 연결: SSE progress 이벤트 payload 타입 (API 명세서 3.4.1.11)
interface SseProgressPayload {
  task_id: string;
  status: "PROCESSING" | "FAILED" | "CANCELED";
  progress: number;
}

// 🔌 API 연결: SSE complete 이벤트 payload 타입 (API 명세서 3.4.1.11)
// 성공은 complete, 실패·취소는 progress 이벤트의 status로 전달됩니다.
interface SseCompletePayload {
  status: "COMPLETED";
  result: {
    task_id: string;
    song_id?: number;
    generation_id?: number;
    audio_url: string;
    duration_seconds: number;
  };
}

// 초 단위를 "m:ss" 형식 문자열로 변환하는 유틸
// 🔌 API 연결: SSE/응답으로 받은 duration_seconds(숫자)를 화면 표시용 문자열로 변환하기 위해 추가
function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Generation() {
  // ── 상태 관리 ──────────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const rootId = Number(searchParams.get("root_generation_id")) || null;
  const accessToken = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<GenerationStatus>(rootId ? "done" : "idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadVersion, setDownloadVersion] = useState<SongVersion | null>(null);

  // ── 오디오 재생 ref ────────────────────────────────────────────────────────
  // 재생/정지 제어용 Audio 인스턴스를 ref로 보관 (state로 두면 불필요한 리렌더링 발생)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── AI 수정 패널 상태 ─────────────────────────────────────────────────────
  const [isModifyOpen, setIsModifyOpen] = useState(false); // 패널 열림/닫힘
  const [modPrompt, setModPrompt] = useState(""); // 입력 중인 프롬프트
  const [isModGenerating, setIsModGenerating] = useState(false); // 수정 생성 중 여부
  const [modVersions, setModVersions] = useState<ModVersion[]>([]); // 수정 버전 히스토리

  const [isHistoryLoading, setIsHistoryLoading] = useState(Boolean(rootId));
  const [isReverting, setIsReverting] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [taskNotice, setTaskNotice] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const [startSec, setStartSec] = useState("0");
  const [endSec, setEndSec] = useState("5");
  const operationRef = useRef(false);
  const streamRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.abort();
      audioRef.current?.pause();
    };
  }, []);

  // 원본 ID는 URL에 남겨 새로고침 후에도 서버 히스토리를 복원합니다.
  useEffect(() => {
    if (!rootId || !accessToken) return;
    const ctrl = new AbortController();
    generationRequest<VersionHistory>(`/${rootId}/versions`, accessToken, { signal: ctrl.signal })
      .then((history) => {
        if (ctrl.signal.aborted) return;
        if (!history.versions.length) throw new Error("완료된 버전이 없습니다.");
        const versions = [...history.versions].sort((a, b) => a.version_no - b.version_no);
        audioRef.current?.pause();
        audioRef.current = null;
        setIsPlaying(false);
        setModVersions(versions.map((v, i) => ({ ...v, isActive: i === versions.length - 1 })));
        setStatus("done");
        setHistoryError("");
        setIsHistoryLoading(false);
        setIsModifyOpen(true);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setHistoryError(err instanceof Error ? err.message : "히스토리를 불러오지 못했습니다.");
        setIsHistoryLoading(false);
      });
    return () => ctrl.abort();
  }, [rootId, accessToken, historyRevision]);

  // ✅ 현재 활성화된(isActive가 true인) 버전
  const activeVersion = modVersions.find((v) => v.isActive);
  const isBusy = isModGenerating || isReverting || isHistoryLoading;
  const rangeError = activeVersion
    ? validateModification(startSec === "" ? NaN : Number(startSec), endSec === "" ? NaN : Number(endSec), activeVersion.duration_seconds, modPrompt.trim())
    : "수정할 곡을 불러와주세요.";

  // 🔌 API 연결: API Base URL
  // TODO: 실제 배포 시 .env (VITE_API_BASE_URL 등)로 분리할 것
  const API_BASE_URL = "/api/v1";

  // 🔌 API 연결: 인증 토큰 가져오기
  const getAccessToken = (): string | null => {
    return useAuthStore.getState().accessToken;
  };

  // 🔌 API 연결: store에서 곡 생성에 필요한 값 가져오기
  const getGenerationPayload = () => {
    const { selectedGenre, selectedMoods, musicDirection } = useConceptStore.getState();
    const { hummingId } = useHummingStore.getState();
    const prompt = musicDirection.trim();

    return {
      humming_id: hummingId,
      genre: selectedGenre ?? "kpop",
      mood: selectedMoods[0] ?? "exciting",
      ...(prompt ? { prompt } : {}),
      reference_track_id: null as number | null,
    };
  };

  // 🔌 API 연결: SSE 스트림 구독 공통 함수
  const subscribeToTaskStream = (
    streamTaskId: string,
    onProgress: (data: SseProgressPayload) => void,
    onComplete: (data: SseCompletePayload) => void,
    onError: () => void,
    onCanceled: () => void,
  ) => {
    const accessToken = getAccessToken();
    const ctrl = new AbortController();
    
    // Vercel 프록시의 10초 타임아웃 제한을 우회하기 위해 상용(Vercel) 환경에서는 EC2 백엔드 서버에 직접 연결합니다.
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const backendHost = isLocal ? "" : "https://humix.my-project.cloud";
    const url = `${backendHost}${API_BASE_URL}/generation/songs/tasks/${streamTaskId}/stream`;

    streamRef.current?.abort();
    streamRef.current = ctrl;
    let finished = false;
    const fail = () => {
      if (finished || ctrl.signal.aborted) return;
      finished = true;
      onError();
      ctrl.abort();
    };
    fetchEventSource(url, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: ctrl.signal,
      openWhenHidden: true,
      async onopen(response) {
        if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
          throw new Error("작업 진행 정보를 불러오지 못했습니다.");
        }
      },
      onmessage(ev) {
        if (finished || ctrl.signal.aborted) return;
        if (ev.event.toLowerCase() === "failed" || ev.event === "error") {
          fail();
          return;
        }
        // connect / heartbeat는 JSON이 아닐 수도 있으므로 파싱하지 않습니다.
        if (ev.event !== "progress" && ev.event !== "complete") return;
        const data = JSON.parse(ev.data);
        if (data.status === "CANCELED") {
          finished = true;
          onCanceled();
          ctrl.abort();
        } else if (data.status === "FAILED") {
          fail();
        } else if (ev.event === "progress") {
          onProgress(data as SseProgressPayload);
        } else if (ev.event === "complete") {
          onComplete(data as SseCompletePayload);
          finished = true;
          ctrl.abort();
        }
      },
      onerror(err) {
        fail();
        throw err;
      },
      onclose() { fail(); },
    }).catch(() => { fail(); });

    return ctrl;
  };

  // ── AI 생성 시작 핸들러 ────────────────────────────────────────────────────
  const handleGenerate = () => {
    setTaskNotice("");
    setStatus("generating");
    setProgressMsg("AI가 멜로디를 작곡하고 있습니다.");

    const startGeneration = async () => {
      try {
        const accessToken = getAccessToken();
        const payload = getGenerationPayload();

        // 1) [API-1] 곡 생성 요청
        const res = await fetch(`${API_BASE_URL}/generation/songs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            humming_id: payload.humming_id,
            title: "my_song",
            genre: payload.genre,
            mood: payload.mood,
            ...(payload.prompt ? { prompt: payload.prompt } : {}),
            reference_track_id: payload.reference_track_id,
          }),
        });

        if (!res.ok) {
          throw new Error("곡 생성 요청 실패");
        }

        // ← result로 수정 (백엔드 실제 envelope 기준)
        const json: ApiEnvelope<GenerationTaskResponse> = await res.json();
        if (!mountedRef.current) return;
        const newTaskId = json.result.task_id;

        // 2) [API-2] SSE 구독
        subscribeToTaskStream(
          newTaskId,
          (data) => {
            setProgressMsg(
              `AI가 곡을 생성하고 있습니다... (${data.progress}%)`,
            );
          },
          (data) => {
            const id = data.result.generation_id ?? data.result.song_id;
            if (!id) throw new Error("생성된 곡 ID가 없습니다.");
            setStatus("done");
            setModVersions([{
              generation_id: id, version_no: 1, prompt: null,
              start_time_sec: null, end_time_sec: null, isActive: true,
              audio_url: data.result.audio_url, duration_seconds: data.result.duration_seconds,
            }]);
            setIsHistoryLoading(true);
            setSearchParams((prev) => { prev.set("root_generation_id", String(id)); return prev; }, { replace: true });
          },
          () => {
            setStatus("error");
          },
          () => {
            setStatus("idle");
            setProgressMsg("");
            setTaskNotice("곡 생성이 취소되었습니다. 다시 생성할 수 있습니다.");
          },
        );
      } catch (err) {
        console.error("[곡 생성 요청 오류]", err);
        setStatus("error");
      }
    };

    startGeneration();
  };

  // ── 재생/정지 핸들러 ───────────────────────────────────────────────────────
  const handlePlayToggle = () => {
    if (!activeVersion?.audio_url) return;

    // 아직 Audio 인스턴스가 없거나, 버전이 바뀌어 src가 달라진 경우 새로 생성
    if (!audioRef.current || audioRef.current.src !== activeVersion.audio_url) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(activeVersion.audio_url);
      // 재생이 끝나면 자동으로 정지 상태로 전환
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        // CORS 또는 네트워크 오류 시 콘솔에 출력 (S3 presigned URL CORS 설정 확인 필요)
        console.error("[오디오 재생 오류]", err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  // ── 다운로드 핸들러 ────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!activeVersion?.audio_url) return;
    audioRef.current?.pause();
    setIsPlaying(false);
    setDownloadVersion(activeVersion);
  };

  // 수정 대상은 항상 현재 히스토리의 마지막 버전입니다.
  const handleModSubmit = async () => {
    if (operationRef.current || isBusy || !activeVersion || !accessToken || !rootId) return;
    if (rangeError) { setHistoryError(rangeError); return; }
    operationRef.current = true;
    setIsModGenerating(true);
    setHistoryError("");
    setTaskNotice("");
    const prompt = modPrompt.trim();
    const fail = () => {
      operationRef.current = false;
      setIsModGenerating(false);
      setHistoryError("곡 수정에 실패했습니다. 기존 버전은 유지됩니다. 히스토리를 새로고침한 뒤 다시 시도해주세요.");
    };
    try {
      const result = await generationRequest<GenerationTaskResponse>(`/${activeVersion.generation_id}/modifications`, accessToken, {
        method: "POST",
        body: JSON.stringify({ ...(prompt ? { prompt } : {}), start_time_sec: Number(startSec), end_time_sec: Number(endSec) }),
      });
      if (!mountedRef.current) return;
      subscribeToTaskStream(result.task_id, () => {}, (data) => {
        const id = data.result.generation_id ?? data.result.song_id;
        if (!id) throw new Error("수정된 곡 ID가 없습니다.");
        audioRef.current?.pause();
        audioRef.current = null;
        setIsPlaying(false);
        setModVersions((prev) => [
          ...prev.map((v) => ({ ...v, isActive: false })),
          { generation_id: id, version_no: activeVersion.version_no + 1,
            prompt: prompt || activeVersion.prompt, start_time_sec: Number(startSec), end_time_sec: Number(endSec),
            audio_url: data.result.audio_url, duration_seconds: data.result.duration_seconds, isActive: true },
        ]);
        setModPrompt("");
        setIsModGenerating(false);
        operationRef.current = false;
      }, fail, () => {
        operationRef.current = false;
        setIsModGenerating(false);
        setTaskNotice("곡 수정이 취소되었습니다. 기존 버전은 유지됩니다.");
      });
    } catch (err) {
      operationRef.current = false;
      setIsModGenerating(false);
      setHistoryError(err instanceof Error ? err.message : "수정 요청에 실패했습니다.");
    }
  };

  const handleSetActive = async (id: number) => {
    if (operationRef.current || isBusy || !accessToken) return;
    const message = revertMessage(modVersions, id);
    if (!message || !window.confirm(message)) return;
    operationRef.current = true;
    setIsReverting(true);
    setHistoryError("");
    setTaskNotice("");
    try {
      await generationRequest<{ generation_id: number; deleted_count: number }>(`/${id}/revert`, accessToken, { method: "POST" });
      // 서버 성공 이후에만 잘라냅니다. 실패/취소하면 재생과 히스토리를 유지합니다.
      audioRef.current?.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setModVersions((prev) => {
        const index = prev.findIndex((v) => v.generation_id === id);
        return prev.slice(0, index + 1).map((v) => ({ ...v, isActive: v.generation_id === id }));
      });
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "되돌리기에 실패했습니다.");
    } finally {
      operationRef.current = false;
      setIsReverting(false);
    }
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
      {downloadVersion && <DownloadModal version={downloadVersion} onClose={() => setDownloadVersion(null)} />}
      <div className="max-w-6xl mx-auto">
        {/* ── Stepper (Step 5: 생성) ── */}
        <div className="w-full bg-[#1A1D24] rounded-lg p-5 border border-gray-800 shadow-sm flex items-center justify-center">
          <Stepper currentStep={5} />
        </div>
        <br />

        {/* ── 페이지 타이틀 ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">AI 곡 완성</h1>
          <p className="text-sm text-gray-500">
            설정을 확인하고 곡을 생성하세요
          </p>
        </div>

        {/* ── 메인 카드 ── */}
        <div className="bg-[#15171C] border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col gap-6">
          {/* ── 생성 설정 요약 ── */}
          <div>
            <p className="text-xs text-gray-500 mb-3 font-medium tracking-wide uppercase">
              생성 설정 요약
            </p>
            <div className="flex flex-col gap-2.5">
              {DUMMY_SUMMARY.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 구분선 ── */}
          <div className="border-t border-gray-800" />

          {rootId && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              {isHistoryLoading ? "히스토리를 불러오는 중…" : "서버에 저장된 버전 히스토리"}
              <button disabled={isBusy || !accessToken} onClick={() => { setIsHistoryLoading(true); setHistoryRevision((v) => v + 1); }} className="text-purple-400 disabled:opacity-40">히스토리 새로고침</button>
              {!accessToken && <span>로그인이 필요합니다.</span>}
            </div>
          )}
          {historyError && <p role="alert" className="text-sm text-red-400">{historyError}</p>}
          {taskNotice && <p role="status" className="text-sm text-violet-300">{taskNotice}</p>}

          {/* ── 생성 전(idle): AI 생성 시작 버튼 ── */}
          {status === "idle" && (
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                className="px-8 py-3 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-bold transition-colors duration-200 shadow-lg shadow-[#8B5CF6]/30"
              >
                AI 생성 시작
              </button>
            </div>
          )}

          {/* ── 생성 중(generating) ── */}
          {status === "generating" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="text-5xl animate-bounce">🎵</div>
              <div className="w-6 h-6 rounded-full border-2 border-gray-700 border-t-[#8B5CF6] animate-spin mt-1" />
              <p className="text-sm text-gray-400">{progressMsg}</p>
            </div>
          )}

          {/* ── 생성 완료(done): 결과 표시 ── */}
          {status === "done" && activeVersion && (
            <div className="flex flex-col gap-4">
              {/* 완료 카드 */}
              <div className="bg-[#0f1015] border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
                {/* 완료 헤더 + AI로 수정하기 버튼 */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      <span>🎉</span>
                      {activeVersion.version_no === 1
                        ? "버전 1 (원본) 생성 완료!"
                        : `버전 ${activeVersion.version_no} 생성 완료!`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      humix_v{activeVersion.version_no}.wav ·{" "}
                      {formatDuration(activeVersion?.duration_seconds ?? 0)}
                    </p>
                  </div>

                  <button
                    onClick={() => setIsModifyOpen((prev) => !prev)}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 border
                      ${
                        isModifyOpen
                          ? "bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#8B5CF6]"
                          : "bg-transparent border-gray-700 text-gray-400 hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                      }`}
                  >
                    ✏️ AI로 수정하기
                  </button>
                </div>

                {/* 파형 시각화 영역 (더미) */}
                {/* TODO: Wavesurfer.js 또는 Web Audio API로 실제 파형 렌더링 교체 */}
                <div className="w-full h-20 rounded-lg bg-[#1A1D24] border border-gray-800 flex items-center px-3 gap-[2px] overflow-hidden">
                  {Array.from({ length: 80 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-[#8B5CF6] to-pink-400 opacity-80"
                      style={{
                        height: `${20 + Math.sin(i * 0.4) * 15 + ((i * 47) % 30)}%`,
                      }}
                    />
                  ))}
                </div>

                {/* 타임라인 */}
                <div className="flex justify-between text-xs text-gray-600 px-1">
                  <span>0:00</span>
                  <span>{formatDuration(activeVersion?.duration_seconds ?? 0)}</span>
                </div>

                {/* 재생 / 다운로드 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={handlePlayToggle}
                    className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#8B5CF6]/20"
                  >
                    {isPlaying ? "⏸ 정지" : "▶ 재생"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 rounded-lg bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    ↓ 다운로드
                  </button>
                </div>
              </div>

              {/* ── AI 수정 패널 ── */}
              {isModifyOpen && (
                <div className="bg-[#0f1015] border border-[#8B5CF6]/30 rounded-xl p-5 flex flex-col gap-4 animate-fade-in">
                  <p className="text-sm font-semibold text-white">
                    AI로 수정하기
                  </p>
                  <p className="text-xs text-gray-500">
                    마음에 안 드는 부분을 자유롭게 입력하면 AI가 해당 부분을
                    수정해요
                  </p>

                  {/* 수정 버전 히스토리 */}
                  {modVersions.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-gray-600 font-medium mt-2">
                        수정 히스토리
                      </p>

                      {modVersions.map((v, i) => (
                        <div
                          key={v.generation_id}
                          className={`bg-[#1A1D24] border ${v.isActive ? "border-[#8B5CF6]/50" : "border-gray-800"} rounded-lg p-4 flex flex-col gap-3 transition-colors`}
                        >
                          {/* 버전 헤더 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${v.isActive ? "text-gray-200" : "text-gray-500"}`}
                              >
                                {i === 0 ? "버전 1 (원본)" : `버전 ${v.version_no}`}
                              </span>
                              {v.isActive && (
                                <span className="px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#8B5CF6] text-xs font-medium">
                                  현재 활성화됨
                                </span>
                              )}
                            </div>
                            {!v.isActive && (
                              <button
                                disabled={isBusy}
                                onClick={() => handleSetActive(v.generation_id)}
                                className="text-xs text-gray-500 hover:text-[#8B5CF6] transition-colors duration-200"
                              >
                                이 버전으로 되돌리기
                              </button>
                            )}
                          </div>

                          {/* 프롬프트 내용 (원본은 표시 안 함) */}
                          {i !== 0 && v.prompt && (
                            <p className="text-xs text-gray-400 bg-[#0f1015] rounded px-3 py-2 border border-gray-800">
                              "{v.prompt}"
                            </p>
                          )}

                          {/* 더미 파형 (버전별) */}
                          <div className="w-full h-12 rounded bg-[#0f1015] border border-gray-800 flex items-center px-2 gap-[2px] overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                            {Array.from({ length: 60 }).map((_, j) => (
                              <div
                                key={j}
                                className={`flex-1 rounded-sm ${v.isActive ? "bg-gradient-to-t from-[#8B5CF6] to-pink-400" : "bg-gray-700"}`}
                                style={{
                                  height: `${20 + Math.sin((j + i * 10) * 0.5) * 15 + ((j * 43 + i * 17) % 25)}%`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                    <span>수정 구간 (최소 5초)</span>
                    <label>시작 (초) <input aria-label="수정 시작 초" type="number" min={0} max={activeVersion.duration_seconds} step={1} value={startSec} disabled={isBusy} onChange={(e) => setStartSec(e.target.value)} className="w-20 rounded bg-[#1A1D24] p-2" /></label>
                    <label>끝 (초) <input aria-label="수정 종료 초" type="number" min={5} max={activeVersion.duration_seconds} step={1} value={endSec} disabled={isBusy} onChange={(e) => setEndSec(e.target.value)} className="w-20 rounded bg-[#1A1D24] p-2" /></label>
                  </div>
                  {rangeError && <p className="text-xs text-amber-400">{rangeError}</p>}
                  {isModGenerating && <p role="status" className="text-sm text-purple-400">AI가 선택한 구간을 수정하고 있습니다…</p>}
                  {isReverting && <p role="status" className="text-sm text-purple-400">이후 버전을 삭제하고 있습니다…</p>}

                  {/* 프롬프트 입력창 */}
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1 bg-[#1A1D24] border border-gray-700 focus-within:border-[#8B5CF6] rounded-lg px-4 py-3 transition-colors duration-200">
                      <textarea
                        maxLength={500}
                        disabled={isBusy}
                        value={modPrompt}
                        onChange={(e) => setModPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleModSubmit();
                          }
                        }}
                        placeholder="예: 코러스를 더 웅장하게 바꿔줘, 드럼을 더 강하게..."
                        rows={2}
                        className="w-full bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none"
                      />
                    </div>
                    <button
                      onClick={handleModSubmit}
                      disabled={isBusy || !accessToken || Boolean(rangeError)}
                      className={`px-4 py-3 rounded-lg text-sm font-bold transition-all duration-200 shrink-0 h-[66px]
                        ${
                          !isBusy && accessToken && !rangeError
                            ? "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/20"
                            : "bg-gray-800 text-gray-600 cursor-not-allowed"
                        }`}
                    >
                      {isModGenerating ? (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-600 border-t-white animate-spin" />
                      ) : (
                        "전송"
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-700">
                    Enter로 전송 · Shift+Enter로 줄바꿈 · 최대 500자 (비우면 현재 버전의 프롬프트 사용)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── 에러 상태 ── */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-red-400">
                곡 생성 중 오류가 발생했어요. 다시 시도해주세요.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="px-6 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-bold transition-colors duration-200"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
        {/* ── 메인 카드 끝 ── */}
      </div>
    </div>
  );
}
