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
 * Body: { humming_id, genre, mood, melody_vectors, reference_track_id }
 * → task_id 반환
 *
 * [API-2] 생성 진행률 실시간 구독 (SSE)
 * GET /api/v1/generation/songs/tasks/{task_id}/stream
 * Headers: Accept: text/event-stream
 * → event: progress / complete 수신
 * → complete 시 audio_url, song_id 포함
 * ─────────────────────────────────────────────
 */

import { useState } from 'react';
import Stepper from '../components/Stepper';
// 🔌 API 연결: EventSource는 Authorization 등 커스텀 헤더를 지정할 수 없어
//             fetch 기반으로 헤더를 자유롭게 설정 가능한 라이브러리로 교체 (명세서 비고: "헤더 수정 불가 시 외부 라이브러리 사용" 지침 반영)
//             설치: npm install @microsoft/fetch-event-source
import { fetchEventSource } from '@microsoft/fetch-event-source';

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
    icon: '🎤',
    label: '허밍 녹음',
    value: '완료 (8.0s)',
  },
  {
    icon: '🎼',
    label: '멜로디 벡터',
    value: '6개 노트 추출',
  },
  {
    icon: '🎸',
    label: '장르',
    value: 'K-POP',
  },
  {
    icon: '🌤',
    label: '분위기',
    value: '밝고 신나는',
  },
  {
    icon: '🎵',
    label: '스타일 참조',
    // TODO: referenceTrackId가 null이면 '선택 없음' 표시
    value: '선택 없음',
  },
];

// ── 생성 상태 타입 ────────────────────────────────────────────────────────
type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

// ── 수정 버전 타입 ────────────────────────────────────────────────────────
// AI로 수정하기 패널에서 생성되는 각 수정 버전
interface ModVersion {
  // ✅ 수정: 원본 데이터의 고유값을 'original'이라는 문자열로 저장하기 위해 id의 타입을 `number | string`으로 확장했습니다.
  id: number | string;
  prompt: string;    // 사용자가 입력한 수정 프롬프트
  isActive: boolean; // 현재 적용 중인 버전 여부
  // ✅ 추가: 메인 플레이어와 연동하기 위해 오디오 관련 정보를 추가했습니다.
  audioUrl?: string; 
  durationStr?: string;
}

// 🔌 API 연결: API 응답 Envelope 공통 타입 ({ code, message, data } 패턴, API 명세서 3.4 참고)
interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

// 🔌 API 연결: [API-1] 곡 생성 요청 응답 타입 (API 명세서 3.4.1.8)
interface GenerationTaskResponse {
  task_id: string;
}

// 🔌 API 연결: SSE progress 이벤트 payload 타입 (API 명세서 3.4.1.11)
interface SseProgressPayload {
  task_id: string;
  status: 'PROCESSING';
  progress: number;
}

// 🔌 API 연결: SSE complete 이벤트 payload 타입 (API 명세서 3.4.1.11)
// 비고: 명세서 원문에는 이벤트명이 "complete"로 되어 있음 (기존 코드 주석의 "completed"와 철자가 다름).
//       백엔드와 실제 이벤트명("complete" vs "completed") 확인 필요.
interface SseCompletePayload {
  status: 'COMPLETED';
  result: {
    task_id: string;
    song_id: number;
    audio_url: string;
    duration_seconds: number;
  };
}

// 초 단위를 "m:ss" 형식 문자열로 변환하는 유틸
// 🔌 API 연결: SSE/응답으로 받은 duration_seconds(숫자)를 화면 표시용 문자열로 변환하기 위해 추가
function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Generation() {
  // ── 상태 관리 ──────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // ── AI 수정 패널 상태 ─────────────────────────────────────────────────────
  const [isModifyOpen, setIsModifyOpen] = useState(false);   // 패널 열림/닫힘
  const [modPrompt, setModPrompt] = useState('');            // 입력 중인 프롬프트
  const [isModGenerating, setIsModGenerating] = useState(false); // 수정 생성 중 여부
  const [modVersions, setModVersions] = useState<ModVersion[]>([]); // 수정 버전 히스토리

  // 🔌 API 연결: [API-2] SSE로 받은 audio_url 저장
  // 비고: 현재는 modVersions 배열 안에 동일한 audioUrl이 버전별로 저장되어 화면 표시는
  //       activeVersion.audioUrl 쪽에서 처리함. 이 state 자체는 곡 생성 완료 시점의 "최초 원본 URL"을
  //       별도로 보관해두기 위한 용도(추후 원본 비교/복구 기능 등에 사용 예정)라 일단 set만 하고 읽지는 않음.
  //       빌드 시 TS6133(미사용 변수) 에러 방지를 위해 void로 의도적 보관임을 명시.
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  void audioUrl;

  // 🔌 API 연결: [API-1] 반환된 task_id 저장
  // 비고: 현재 UI에서 직접 읽지는 않지만, 추후 "생성 취소" 기능(API 명세서 3.4.1.9,
  //       DELETE /api/v1/generation/songs/tasks/{task_id}) 연결 시 필요해 미리 보관해둠.
  const [taskId, setTaskId] = useState<string | null>(null);
  void taskId;

  // 🔌 API 연결: complete 응답에 포함된 song_id 저장 (AI 수정 요청 시 URL 파라미터로 필요, API 명세서 3.4.1.10)
  // 비고: AI 수정 API가 현재 비활성화(주석 처리)되어 있어 당장은 읽는 곳이 없음.
  //       AI 수정 기능 재활성화 시 handleModSubmit 내부에서 사용됨.
  const [songId, setSongId] = useState<number | null>(null);
  void songId;

  // ✅ 추가: 현재 활성화된(isActive가 true인) 버전을 찾는 변수 선언
  const activeVersion = modVersions.find((v) => v.isActive);
  // ✅ 추가: 현재 활성화된 버전이 히스토리 배열에서 몇 번째 인덱스인지 계산합니다.
  const activeIndex = modVersions.findIndex((v) => v.isActive);

  // 🔌 API 연결: API Base URL
  // TODO: 실제 배포 시 .env (VITE_API_BASE_URL 등)로 분리할 것
  const API_BASE_URL = '/api/v1';

  // 🔌 API 연결: 인증 토큰 가져오기
  // TODO: 인증 연동 전이라 임시로 비워둠. 인증 플로우 연결 후
  //       실제 access_token 저장 위치(예: Zustand auth store)에서 가져오도록 교체해야 함.
  const getAccessToken = (): string | null => {
    // TODO: 예) return useAuthStore.getState().accessToken;
    return null;
  };

  // 🔌 API 연결: store에서 곡 생성에 필요한 값 가져오기
  // TODO: useConceptStore에는 genre, mood까지만 확인됨 (선택한 장르 1개 / 분위기 1개가 정상 반영됨을 확인).
  //       humming_id, melody_vectors는 store에 아직 없는 값으로 보임 — 허밍/멜로디 편집 단계(UC1, UC2) 작업자와
  //       필드 추가를 협의해야 함. 현재는 임시로 null/빈 배열을 사용하고 있어 실제 곡 생성 요청 시 백엔드에서
  //       에러가 날 수 있음.
  // import { useConceptStore } from '../store/useConceptStore';
  // const { genre, mood, referenceTrackId } = useConceptStore();
  const getGenerationPayload = () => {
    // TODO: 아래 값들을 store에서 가져오도록 교체
    return {
      humming_id: null as number | null, // TODO: store에 필드 없음 — 허밍 녹음 단계에서 받은 humming_id 연결 필요
      genre: 'kpop', // TODO: useConceptStore의 genre 값으로 교체 (현재 enum 매핑 확인 필요: kpop/folks/classical/jazz/cinematic)
      mood: 'exciting', // TODO: useConceptStore의 mood 값으로 교체
      melody_vectors: [] as Array<{ pitch: number; onset_seconds: number; duration_seconds: number }>, // TODO: store에 필드 없음 — 멜로디 편집 단계(UC2) 결과 연결 필요
      reference_track_id: null as number | null, // TODO: ReferenceUpload.tsx에서 저장한 reference_track_id 연결 필요
    };
  };

  // 🔌 API 연결: SSE 스트림 구독 공통 함수
  // 곡 생성([API-2])과 AI 수정 모두 동일한 stream 엔드포인트(API 명세서 3.4.1.11)를 사용하므로 공통 함수로 분리.
  // onProgress: progress 이벤트 수신 시 호출, onComplete: complete 이벤트 수신 시 호출, onError: 에러/연결 끊김 시 호출
  //
  // 비고: 기본 EventSource는 Authorization 등 커스텀 헤더를 지정할 수 없어, 헤더를 자유롭게 설정 가능한
  //       @microsoft/fetch-event-source 라이브러리로 인증 헤더를 전송함 (fetch 기반 SSE 클라이언트).
  // 비고: SSE complete 이벤트명은 API 명세서 3.4.1.11 원문 기준 "complete" 사용 (백엔드와 합의됨).
  const subscribeToTaskStream = (
    streamTaskId: string,
    onProgress: (data: SseProgressPayload) => void,
    onComplete: (data: SseCompletePayload) => void,
    onError: () => void
  ) => {
    const accessToken = getAccessToken();
    const ctrl = new AbortController();
    const url = `${API_BASE_URL}/generation/songs/tasks/${streamTaskId}/stream`;

    fetchEventSource(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: ctrl.signal,
      // 탭이 백그라운드로 가도 연결이 끊기지 않도록 설정 (생성 중 다른 탭을 보더라도 진행 상황을 놓치지 않기 위함)
      openWhenHidden: true,
      onmessage(ev) {
        if (ev.event === 'progress') {
          const data: SseProgressPayload = JSON.parse(ev.data);
          onProgress(data);
        } else if (ev.event === 'complete') {
          const data: SseCompletePayload = JSON.parse(ev.data);
          onComplete(data);
          ctrl.abort();
        }
      },
      onerror(err) {
        onError();
        // 에러를 던지면 재시도를 막고 즉시 연결을 종료함 (기본 동작은 자동 재시도이므로 명시적으로 막아야 함)
        throw err;
      },
    }).catch(() => {
      // ctrl.abort()로 인한 정상 종료 시에도 onerror/catch가 호출될 수 있어 별도 처리 없이 무시
    });

    return ctrl;
  };

  // ── AI 생성 시작 핸들러 ────────────────────────────────────────────────────
  const handleGenerate = () => {
    setStatus('generating');
    setProgressMsg('AI가 멜로디를 작곡하고 있습니다.');

    // 🔌 API 연결: [API-1] 곡 생성 요청 → [API-2] SSE 구독
    const startGeneration = async () => {
      try {
        const accessToken = getAccessToken();
        const payload = getGenerationPayload();

        // 1) [API-1] 곡 생성 요청 (API 명세서 3.4.1.8)
        const res = await fetch(`${API_BASE_URL}/generation/songs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            humming_id: payload.humming_id,
            title: 'my_song', // TODO: 사용자가 곡 제목을 입력하는 UI가 없어 임시 고정값 사용. 필요 시 입력 필드 추가 논의.
            genre: payload.genre,
            mood: payload.mood,
            reference_track_id: payload.reference_track_id,
          }),
        });

        if (!res.ok) {
          throw new Error('곡 생성 요청 실패');
        }

        const json: ApiEnvelope<GenerationTaskResponse> = await res.json();
        const newTaskId = json.data.task_id;
        setTaskId(newTaskId);

        // 2) [API-2] SSE 구독
        subscribeToTaskStream(
          newTaskId,
          (data) => {
            // TODO: 명세서 progress 이벤트에는 message 필드가 없고 progress(숫자, %) 필드만 있음.
            //       기존 UI는 텍스트 메시지(progressMsg)를 보여주는 구조라, 우선 진행률(%)을 텍스트로 변환해 표시.
            //       디자인팀과 협의해 진행률 바 UI로 바꾸거나, 백엔드에 message 필드 추가를 요청하는 것을 고려.
            setProgressMsg(`AI가 곡을 생성하고 있습니다... (${data.progress}%)`);
          },
          (data) => {
            setAudioUrl(data.result.audio_url);
            setSongId(data.result.song_id);
            setStatus('done');
            // ✅ 완료되면 '원본' 버전을 히스토리에 먼저 세팅
            setModVersions([
              {
                id: 'original',
                prompt: '최초 생성된 원본 곡입니다.',
                isActive: true,
                audioUrl: data.result.audio_url,
                durationStr: formatDuration(data.result.duration_seconds),
              },
            ]);
          },
          () => {
            setStatus('error');
          }
        );
      } catch (err) {
        console.error('[곡 생성 요청 오류]', err);
        setStatus('error');
      }
    };

    startGeneration();
  };

  // ── 재생/정지 핸들러 ───────────────────────────────────────────────────────
  const handlePlayToggle = () => {
    // ✅ 수정: 재생 시 현재 활성화된 버전의 오디오 URL을 사용해야 함을 명시
    // TODO: Web Audio API 또는 <audio> 태그로 activeVersion.audioUrl 재생/정지
    console.log(`현재 재생 시도 중인 버전 ID: ${activeVersion?.id}`);
    setIsPlaying((prev) => !prev);
  };

  // ── 다운로드 핸들러 ────────────────────────────────────────────────────────
  const handleDownload = () => {
    // ✅ 수정: 다운로드 시 현재 활성화된 버전의 데이터를 사용하도록 연결
    // 🔌 API 연결: activeVersion.audioUrl 파일 다운로드
    if (!activeVersion?.audioUrl) return;
    const a = document.createElement('a');
    a.href = activeVersion.audioUrl;
    a.download = `humix_generated_${activeVersion.id}.wav`;
    a.click();
  };

  // ── AI 수정 요청 핸들러 ────────────────────────────────────────────────────
  // 🔌 API 연결 보류: AI로 수정하기는 백엔드 작업 우선순위에서 빠져 있어, 현재는 UI 동작 확인을 위한
  //                 더미 시뮬레이션으로 되돌려둠. 백엔드 준비되면 아래 주석(startModification) 해제하고
  //                 더미 시뮬레이션 블록을 제거할 것. API 자체는 명세서 3.4.1.10에 정의되어 있음.
  const handleModSubmit = () => {
    if (!modPrompt.trim() || isModGenerating) return;
    const prompt = modPrompt.trim();
    setModPrompt('');
    setIsModGenerating(true);

    // ──────────────────────────────────────────────────────────────────────────
    // 🔌 API 연결 (보류): 백엔드 준비되면 아래 주석을 해제하고, 바로 아래의
    //                   [임시] 시뮬레이션 블록을 제거할 것.
    //
    // const startModification = async () => {
    //   try {
    //     if (songId === null) {
    //       // TODO: 원본 곡 생성이 완료되지 않은 상태에서는 song_id가 없어 수정 요청을 보낼 수 없음.
    //       //       이 케이스는 UI상 '생성 완료' 이후에만 패널이 열리므로 발생하지 않아야 하나 방어 처리.
    //       throw new Error('song_id가 없어 수정 요청을 보낼 수 없습니다.');
    //     }
    //
    //     const accessToken = getAccessToken();
    //
    //     // 1) POST /api/v1/generation/songs/{song_id}/modifications (API 명세서 3.4.1.10)
    //     const res = await fetch(`${API_BASE_URL}/generation/songs/${songId}/modifications`, {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //         ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    //       },
    //       body: JSON.stringify({ prompt }),
    //     });
    //
    //     if (!res.ok) {
    //       throw new Error('수정 요청 실패');
    //     }
    //
    //     const json: ApiEnvelope<GenerationTaskResponse> = await res.json();
    //     const modTaskId = json.data.task_id;
    //
    //     // 2) SSE 구독 — UC6 stream API와 동일한 엔드포인트 사용
    //     subscribeToTaskStream(
    //       modTaskId,
    //       () => {
    //         // TODO: 수정 중 진행 메시지를 별도로 보여줄 UI 요소가 현재 없음 (버튼 스피너만 존재).
    //         //       필요 시 progress 이벤트로 진행률 표시 UI 추가 논의.
    //       },
    //       (data) => {
    //         setModVersions((prev) => [
    //           // 기존 버전은 모두 비활성화
    //           ...prev.map((v) => ({ ...v, isActive: false })),
    //           // 새 버전 추가 (현재 버전으로 설정)
    //           {
    //             id: data.result.song_id,
    //             prompt,
    //             isActive: true,
    //             audioUrl: data.result.audio_url,
    //             durationStr: formatDuration(data.result.duration_seconds),
    //           },
    //         ]);
    //         setIsModGenerating(false);
    //       },
    //       () => {
    //         // TODO: 수정 실패 시 별도 UI 피드백이 없음. 우선 alert로 처리.
    //         alert('곡 수정 중 오류가 발생했어요. 다시 시도해주세요.');
    //         setIsModGenerating(false);
    //       }
    //     );
    //   } catch (err) {
    //     console.error('[AI 수정 요청 오류]', err);
    //     alert('곡 수정 중 오류가 발생했어요. 다시 시도해주세요.');
    //     setIsModGenerating(false);
    //   }
    // };
    //
    // startModification();
    // ──────────────────────────────────────────────────────────────────────────

    // ── [임시] 수정 생성 시뮬레이션 (API 연결 전 UI 확인용) ──────────────────
    setTimeout(() => {
      const newId = Date.now();
      setModVersions((prev) => [
        // 기존 버전은 모두 비활성화
        ...prev.map((v) => ({ ...v, isActive: false })),
        // 새 버전 추가 (현재 버전으로 설정)
        {
          id: newId,
          prompt,
          isActive: true,
          // ✅ 추가: 수정된 버전에 대한 가상의 오디오 정보 부여
          audioUrl: `https://dummy-modified-audio-${newId}.url`,
          durationStr: '1:48',
        },
      ]);
      setIsModGenerating(false);
    }, 3000);
    // ── [임시] 시뮬레이션 끝 ─────────────────────────────────────────────────
  };

  // ── 수정 버전 적용 핸들러 ─────────────────────────────────────────────────
  // ✅ 수정: 파라미터 타입을 확장하여 원본 버전을 뜻하는 'original' (string) 식별자도 정상적으로 인자로 받을 수 있도록 처리했습니다.
  const handleSetActive = (id: number | string) => {
    // ✅ 수정: 해당 버전의 audio_url로 재생 상태 교체 (modVersions 안에 이미 audioUrl이 저장되어 있어 별도 API 호출 불필요)
    setModVersions((prev) =>
      prev.map((v) => ({ ...v, isActive: v.id === id }))
    );
    // ✅ 추가: 버전을 바꿀 때 재생 중이던 음악을 정지시키는 로직
    setIsPlaying(false);
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
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
                // TODO: DUMMY_SUMMARY → Zustand store 값으로 교체
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {/* 요약 값 — 모두 흰색으로 통일 */}
                  <span className="text-sm font-medium text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 구분선 ── */}
          <div className="border-t border-gray-800" />

          {/* ── 생성 전(idle): AI 생성 시작 버튼 ── */}
          {status === 'idle' && (
            <div className="flex justify-end">
              {/* AI 생성 시작 버튼 — 스텝퍼 색상(#8B5CF6)과 통일
               * TODO: 클릭 시 handleGenerate() 호출 → [API-1] 연결
               */}
              <button
                onClick={handleGenerate}
                className="px-8 py-3 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-bold transition-colors duration-200 shadow-lg shadow-[#8B5CF6]/30"
              >
                AI 생성 시작
              </button>
            </div>
          )}

          {/* ── 생성 중(generating): 요약 카드 중앙에 이모지 + 메시지 표시 ── */}
          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              {/* 음악 생성 중 이모지 */}
              <div className="text-5xl animate-bounce">🎵</div>
              {/* 스피너 */}
              <div className="w-6 h-6 rounded-full border-2 border-gray-700 border-t-[#8B5CF6] animate-spin mt-1" />
              {/* SSE로 받은 진행 메시지 표시 */}
              {/* TODO: progressMsg → SSE event: progress data.message 로 교체 */}
              <p className="text-sm text-gray-400">{progressMsg}</p>
            </div>
          )}

          {/* ── 생성 완료(done): 결과 표시 ── */}
          {status === 'done' && (
            <div className="flex flex-col gap-4">

              {/* 완료 카드 */}
              <div className="bg-[#0f1015] border border-gray-800 rounded-xl p-5 flex flex-col gap-4">

                {/* 완료 헤더 + AI로 수정하기 버튼 */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      <span>🎉</span> 
                      {/* ✅ 수정: 사용자가 인지하기 쉽도록 현재 활성화된 인덱스를 판별해 타이틀 텍스트를 동적으로 출력합니다. */}
                      {activeIndex === 0 
                        ? '버전 1 (원본) 생성 완료!' 
                        : `버전 ${activeIndex + 1} 생성 완료!`}
                    </p>
                    {/* ✅ 수정: 오디오 파일명 규칙도 텍스트 상단 타이틀 번호(v1, v2...)와 일치하도록 연동했습니다. */}
                    {/* TODO: 실제 파일명과 재생 시간으로 교체 (audio_url, duration_seconds) */}
                    <p className="text-xs text-gray-500 mt-0.5">
                      humix_v{activeIndex + 1}.wav · {activeVersion?.durationStr || '0:00'}
                    </p>
                  </div>

                  {/* AI로 수정하기 버튼 — 클릭 시 하단 수정 패널 토글
                   * 🔌 API 연결: POST /api/v1/generation/songs/{song_id}/modifications (handleModSubmit에서 연결됨)
                   */}
                  <button
                    onClick={() => setIsModifyOpen((prev) => !prev)}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 border
                      ${isModifyOpen
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#8B5CF6]'
                        : 'bg-transparent border-gray-700 text-gray-400 hover:border-[#8B5CF6] hover:text-[#8B5CF6]'
                      }`}
                  >
                    ✏️ AI로 수정하기
                  </button>
                </div>

                {/* 파형 시각화 영역 (더미) */}
                {/* TODO: Wavesurfer.js 또는 Web Audio API로 실제 파형 렌더링 교체 */}
                {/* ✅ 수정: 파형 끊김 문제와 재렌더링 시 흔들림 문제를 모두 방지하기 위해, 음수가 발생하지 않으면서도 위치별로 값이 고정되는 수식((i * 47) % 30)으로 대체했습니다. */}
                <div className="w-full h-20 rounded-lg bg-[#1A1D24] border border-gray-800 flex items-center px-3 gap-[2px] overflow-hidden">
                  {Array.from({ length: 80 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-[#8B5CF6] to-pink-400 opacity-80"
                      style={{ height: `${20 + Math.sin(i * 0.4) * 15 + ((i * 47) % 30)}%` }}
                    />
                  ))}
                </div>

                {/* 타임라인 */}
                <div className="flex justify-between text-xs text-gray-600 px-1">
                  <span>0:00</span>
                  {/* ✅ 수정: 타임라인 끝 시간도 활성화된 버전에 맞게 연동 */}
                  <span>{activeVersion?.durationStr || '1:45'}</span>
                </div>

                {/* 재생 / 다운로드 버튼 */}
                <div className="flex gap-3">
                  {/* 재생 버튼 — 스텝퍼 색상(#8B5CF6)과 통일 */}
                  <button
                    onClick={handlePlayToggle}
                    className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#8B5CF6]/20"
                  >
                    {isPlaying ? '⏸ 정지' : '▶ 재생'}
                  </button>
                  {/* 다운로드 버튼 */}
                  {/* 🔌 API 연결: handleDownload → activeVersion.audioUrl 다운로드 연결됨 */}
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 rounded-lg bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    ↓ 다운로드
                  </button>
                </div>
              </div>

              {/* ── AI 수정 패널 (AI로 수정하기 클릭 시 펼쳐짐) ── */}
              {/* 🔌 API 연결:
               * 1) POST /api/v1/generation/songs/{song_id}/modifications (handleModSubmit)
               * 2) GET  /api/v1/generation/songs/tasks/{task_id}/stream (SSE, subscribeToTaskStream)
               * → 결과를 modVersions에 추가
               */}
              {isModifyOpen && (
                <div className="bg-[#0f1015] border border-[#8B5CF6]/30 rounded-xl p-5 flex flex-col gap-4 animate-fade-in">

                  <p className="text-sm font-semibold text-white">AI로 수정하기</p>
                  <p className="text-xs text-gray-500">
                    마음에 안 드는 부분을 자유롭게 입력하면 AI가 해당 부분을 수정해요
                  </p>

                  {/* 수정 버전 히스토리 */}
                  {modVersions.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {/* ✅ 수정: '(원본 포함)' 문구를 지워달라는 요청을 반영했습니다. */}
                      <p className="text-xs text-gray-600 font-medium mt-2">수정 히스토리</p>
                      
                      {modVersions.map((v, i) => (
                        <div key={v.id} className={`bg-[#1A1D24] border ${v.isActive ? 'border-[#8B5CF6]/50' : 'border-gray-800'} rounded-lg p-4 flex flex-col gap-3 transition-colors`}>

                          {/* 버전 헤더 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* ✅ 수정: 배열의 첫 번째 요소(인덱스 0)는 무조건 '원본'이므로, 표시할 때 '버전 1 (원본)'이라고 명확히 라벨링해줍니다. */}
                              <span className={`text-xs font-bold ${v.isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                                {i === 0 ? '버전 1 (원본)' : `버전 ${i + 1}`}
                              </span>
                              
                              {/* 현재 적용 버전 뱃지 */}
                              {v.isActive && (
                                <span className="px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#8B5CF6] text-xs font-medium">
                                  현재 활성화됨
                                </span>
                              )}
                            </div>
                            
                            {/* 이 버전 적용 버튼 */}
                            {!v.isActive && (
                              <button
                                onClick={() => handleSetActive(v.id)}
                                className="text-xs text-gray-500 hover:text-[#8B5CF6] transition-colors duration-200"
                              >
                                {/* ✅ 수정: 원본이나 이전 버전으로 '돌아간다'는 의미를 명확히 전달하기 위해 버튼 텍스트를 수정했습니다. */}
                                이 버전으로 되돌리기
                              </button>
                            )}
                          </div>

                          {/* 프롬프트 내용 */}
                          {/* ✅ 수정: '초기 생성 설정 및 허밍 기반 데이터' 텍스트를 삭제해달라는 요청을 반영하여, 인덱스가 0(원본)일 경우에는 프롬프트 텍스트 박스 자체를 렌더링하지 않도록 수정했습니다. */}
                          {i !== 0 && (
                            <p className="text-xs text-gray-400 bg-[#0f1015] rounded px-3 py-2 border border-gray-800">
                              "{v.prompt}"
                            </p>
                          )}

                          {/* 더미 파형 (버전별) */}
                          {/* ✅ 수정: 파형 끊김과 흔들림을 모두 방지하기 위해 랜덤 및 삼각함수 로직을 안전한 수식으로 교체했습니다. */}
                          <div className="w-full h-12 rounded bg-[#0f1015] border border-gray-800 flex items-center px-2 gap-[2px] overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                            {Array.from({ length: 60 }).map((_, j) => (
                              <div
                                key={j}
                                className={`flex-1 rounded-sm ${v.isActive ? 'bg-gradient-to-t from-[#8B5CF6] to-pink-400' : 'bg-gray-700'}`}
                                style={{ height: `${20 + Math.sin((j + i * 10) * 0.5) * 15 + (((j * 43) + (i * 17)) % 25)}%` }}
                              />
                            ))}
                          </div>
                          
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 프롬프트 입력창 */}
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1 bg-[#1A1D24] border border-gray-700 focus-within:border-[#8B5CF6] rounded-lg px-4 py-3 transition-colors duration-200">
                      <textarea
                        value={modPrompt}
                        onChange={(e) => setModPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleModSubmit();
                          }
                        }}
                        placeholder="예: 코러스를 더 웅장하게 바꿔줘, 드럼을 더 강하게..."
                        rows={2}
                        className="w-full bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none"
                      />
                    </div>
                    {/* 전송 버튼 */}
                    <button
                      onClick={handleModSubmit}
                      disabled={!modPrompt.trim() || isModGenerating}
                      // ✅ 추가: 입력창 높이와 버튼 높이를 맞추기 위해 h-[66px]를 주었습니다.
                      className={`px-4 py-3 rounded-lg text-sm font-bold transition-all duration-200 shrink-0 h-[66px]
                        ${modPrompt.trim() && !isModGenerating
                          ? 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/20'
                          : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        }`}
                    >
                      {isModGenerating ? (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-600 border-t-white animate-spin" />
                      ) : (
                        '전송' // ✅ 수정: 사용자의 요청에 따라 다시 '전송' 텍스트로 변경했습니다.
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-700">Enter로 전송 · Shift+Enter로 줄바꿈</p>

                </div>
              )}

            </div>
          )}

          {/* ── 에러 상태 ── */}
          {status === 'error' && (
            // 🔌 API 연결: 에러 발생 시 SSE onerror / fetch catch에서 setStatus('error') 호출됨
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-red-400">곡 생성 중 오류가 발생했어요. 다시 시도해주세요.</p>
              <button
                onClick={() => setStatus('idle')}
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
