/**
 * Generation.tsx
 *
 * [Step 5] AI 곡 완성 페이지
 * 생성 설정 요약을 확인하고 AI 음악 생성 결과를 보여주는 UI 컴포넌트
 *
 * ─────────────────────────────────────────────
 *  TODO: API 연결 포인트 요약 (HuMix_API.pdf 기준)
 * ─────────────────────────────────────────────
 *  [API-1] 곡 생성 요청 (비동기)
 *    POST /api/v1/generation/songs
 *    Body: { humming_id, genre, mood, melody_vectors, reference_track_id }
 *    → task_id 반환
 *
 *  [API-2] 생성 진행률 실시간 구독 (SSE)
 *    GET /api/v1/generation/songs/tasks/{task_id}/stream
 *    Headers: Accept: text/event-stream
 *    → event: progress / completed 수신
 *    → completed 시 audio_url, song_id 포함
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

export default function Generation() {
  // ── 상태 관리 ──────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // TODO: [API-2] SSE로 받은 audio_url 저장
  // const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // TODO: [API-1] 반환된 task_id 저장
  // const [taskId, setTaskId] = useState<string | null>(null);

  // ── AI 생성 시작 핸들러 ────────────────────────────────────────────────────
  const handleGenerate = () => {
    setStatus('generating');

    // ──────────────────────────────────────────────────────────────────────────
    // TODO: 실제 API 연결 시 아래 시뮬레이션을 제거하고 아래 흐름으로 교체:
    //
    //  1) [API-1] 곡 생성 요청
    //     const { task_id } = await fetch('/api/v1/generation/songs', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         humming_id: store.hummingId,          // Zustand에서 가져오기
    //         genre: store.genre,                    // ex) 'folks'
    //         mood: store.moods[0],                  // ex) 'exciting'
    //         melody_vectors: store.melodyVectors,   // UC2 결과값
    //         reference_track_id: store.referenceTrackId ?? null,
    //       }),
    //     }).then(r => r.json());
    //     setTaskId(task_id);
    //
    //  2) [API-2] SSE 구독
    //     const eventSource = new EventSource(
    //       `/api/v1/generation/songs/tasks/${task_id}/stream`
    //     );
    //     eventSource.addEventListener('progress', (e) => {
    //       const data = JSON.parse(e.data);
    //       setProgressMsg(data.message); // ex) 'AI가 멜로디를 작곡하고 있습니다.'
    //     });
    //     eventSource.addEventListener('completed', (e) => {
    //       const data = JSON.parse(e.data);
    //       setAudioUrl(data.result.audio_url);
    //       setStatus('done');
    //       eventSource.close();
    //     });
    //     eventSource.onerror = () => {
    //       setStatus('error');
    //       eventSource.close();
    //     };
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
    }, 5000);
    // ── [임시] 시뮬레이션 끝 ─────────────────────────────────────────────────
  };

  // ── 재생/정지 핸들러 ───────────────────────────────────────────────────────
  const handlePlayToggle = () => {
    // TODO: Web Audio API 또는 <audio> 태그로 audioUrl 재생/정지
    setIsPlaying((prev) => !prev);
  };

  // ── 다운로드 핸들러 ────────────────────────────────────────────────────────
  const handleDownload = () => {
    // TODO: audioUrl로 파일 다운로드
    // const a = document.createElement('a');
    // a.href = audioUrl!;
    // a.download = 'humix_generated.wav';
    // a.click();
    console.log('다운로드');
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

          {/* ── 생성 완료: 결과 표시 ── */}
          {status === 'done' && (
            <div className="bg-[#0f1015] border border-gray-800 rounded-xl p-5 flex flex-col gap-4">

              {/* 완료 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-white flex items-center gap-2">
                    <span>🎉</span> 생성 완료!
                  </p>
                  {/* TODO: 실제 파일명과 재생 시간으로 교체 (audio_url, duration_seconds) */}
                  <p className="text-xs text-gray-500 mt-0.5">
                    humix_generated.wav · 1:45
                  </p>
                </div>
              </div>

              {/* 파형 시각화 영역 (더미) */}
              {/* TODO: Wavesurfer.js 또는 Web Audio API로 실제 파형 렌더링 교체 */}
              <div className="w-full h-20 rounded-lg bg-[#1A1D24] border border-gray-800 flex items-center px-3 gap-[2px] overflow-hidden">
                {Array.from({ length: 80 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-[#8B5CF6] to-pink-400 opacity-80"
                    style={{ height: `${20 + Math.sin(i * 0.4) * 15 + Math.random() * 30}%` }}
                  />
                ))}
              </div>

              {/* 타임라인 */}
              <div className="flex justify-between text-xs text-gray-600 px-1">
                <span>0:00</span>
                <span>1:45</span>
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