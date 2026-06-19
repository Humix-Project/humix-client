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
 * → event: progress / completed 수신
 * → completed 시 audio_url, song_id 포함
 * ─────────────────────────────────────────────
 */

import { useState } from 'react';
import Stepper from '../components/Stepper';

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

  // TODO: [API-2] SSE로 받은 audio_url 저장
  // const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // TODO: [API-1] 반환된 task_id 저장
  // const [taskId, setTaskId] = useState<string | null>(null);

  // ✅ 추가: 현재 활성화된(isActive가 true인) 버전을 찾는 변수 선언
  const activeVersion = modVersions.find((v) => v.isActive);
  // ✅ 추가: 현재 활성화된 버전이 히스토리 배열에서 몇 번째 인덱스인지 계산합니다.
  const activeIndex = modVersions.findIndex((v) => v.isActive);

  // ── AI 생성 시작 핸들러 ────────────────────────────────────────────────────
  const handleGenerate = () => {
    setStatus('generating');

    // ──────────────────────────────────────────────────────────────────────────
    // TODO: 실제 API 연결 시 아래 시뮬레이션을 제거하고 아래 흐름으로 교체:
    //
    //  1) [API-1] 곡 생성 요청
    //    const { task_id } = await fetch('/api/v1/generation/songs', {
    //      method: 'POST',
    //      headers: { 'Content-Type': 'application/json' },
    //      body: JSON.stringify({
    //        humming_id: store.hummingId,          // Zustand에서 가져오기
    //        genre: store.genre,                    // ex) 'folks'
    //        mood: store.moods[0],                  // ex) 'exciting'
    //        melody_vectors: store.melodyVectors,   // UC2 결과값
    //        reference_track_id: store.referenceTrackId ?? null,
    //      }),
    //    }).then(r => r.json());
    //    setTaskId(task_id);
    //
    //  2) [API-2] SSE 구독
    //    const eventSource = new EventSource(
    //      `/api/v1/generation/songs/tasks/${task_id}/stream`
    //    );
    //    eventSource.addEventListener('progress', (e) => {
    //      const data = JSON.parse(e.data);
    //      setProgressMsg(data.message); // ex) 'AI가 멜로디를 작곡하고 있습니다.'
    //    });
    //    eventSource.addEventListener('completed', (e) => {
    //      const data = JSON.parse(e.data);
    //      setAudioUrl(data.result.audio_url);
    //      setStatus('done');
    //      // ✅ 추가: 실제 API 연결 시에도 완료되면 '원본' 버전을 히스토리에 먼저 세팅해주세요.
    //      // setModVersions([{ id: 'original', prompt: '최초 생성된 원본 곡입니다.', isActive: true, audioUrl: data.result.audio_url, durationStr: '1:45' }]);
    //      eventSource.close();
    //    });
    //    eventSource.onerror = () => {
    //      setStatus('error');
    //      eventSource.close();
    //    };
    // ──────────────────────────────────────────────────────────────────────────

    // ── [임시] 생성 진행 시뮬레이션 (API 연결 전 UI 확인용) ──────────────────
    const messages = [
      'AI가 멜로디를 작곡하고 있습니다.',
      '오디오 파일 변환 및 S3 업로드 중입니다.',
    ];
    let i = 0;
    setProgressMsg(messages[0]);
    const msgInterval = setInterval(() => {
      i++;
      if (i < messages.length) setProgressMsg(messages[i]);
    }, 2000);
    setTimeout(() => {
      clearInterval(msgInterval);
      setStatus('done');
      
      // ✅ 추가: 곡 생성이 최초로 완료되었을 때, 수정 히스토리 배열(modVersions)에 '원본' 데이터를 강제로 첫 번째 요소로 주입합니다.
      // 이렇게 해야 AI 수정 패널을 열었을 때 원본 항목이 렌더링되며, 나중에 언제든 최초 상태로 돌아갈 수 있습니다.
      setModVersions([
        {
          id: 'original',
          prompt: '최초 생성된 원본 곡입니다.',
          isActive: true,
          // ✅ 추가: 최초 생성 시 가상의 오디오 정보를 넣어줍니다.
          audioUrl: 'https://dummy-original-audio.url',
          durationStr: '1:45',
        }
      ]);
    }, 5000);
    // ── [임시] 시뮬레이션 끝 ─────────────────────────────────────────────────
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
    // TODO: activeVersion.audioUrl 파일 다운로드
    // const a = document.createElement('a');
    // a.href = activeVersion?.audioUrl!;
    // a.download = `humix_generated_${activeVersion?.id}.wav`;
    // a.click();
    console.log(`[다운로드] 현재 활성 버전 ID: ${activeVersion?.id}, URL: ${activeVersion?.audioUrl}`);
  };

  // ── AI 수정 요청 핸들러 ────────────────────────────────────────────────────
  const handleModSubmit = () => {
    if (!modPrompt.trim() || isModGenerating) return;
    const prompt = modPrompt.trim();
    setModPrompt('');
    setIsModGenerating(true);

    // ──────────────────────────────────────────────────────────────────────────
    // TODO: 실제 API 연결 시 아래 시뮬레이션을 제거하고 아래 흐름으로 교체:
    //
    //  1) POST /api/v1/generation/songs/{song_id}/modifications
    //    const { task_id } = await fetch(`/api/v1/generation/songs/${songId}/modifications`, {
    //      method: 'POST',
    //      headers: { 'Content-Type': 'application/json' },
    //      body: JSON.stringify({ prompt }),
    //    }).then(r => r.json());
    //
    //  2) SSE 구독 — UC6 stream API와 동일한 엔드포인트 사용
    //    GET /api/v1/generation/songs/tasks/{task_id}/stream
    //    → completed 시 새 audio_url을 modVersions에 추가
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
    // TODO: 실제 연결 시 해당 버전의 audio_url로 재생 상태 교체
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
                   * TODO: UI 전용, 실제 수정 API는 추후 연결
                   * POST /api/v1/generation/songs/{song_id}/modifications
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
                  {/* TODO: handleDownload → audioUrl 다운로드 연결 */}
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 rounded-lg bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    ↓ 다운로드
                  </button>
                </div>
              </div>

              {/* ── AI 수정 패널 (AI로 수정하기 클릭 시 펼쳐짐) ── */}
              {/* TODO: UI 전용 구현. 실제 API 연결 시:
               * 1) POST /api/v1/generation/songs/{song_id}/modifications
               * 2) GET  /api/v1/generation/songs/tasks/{task_id}/stream (SSE)
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
            // TODO: 에러 발생 시 SSE onerror에서 setStatus('error') 호출
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
