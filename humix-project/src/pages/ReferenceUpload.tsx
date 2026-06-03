/**
 * ReferenceUpload.tsx
 * * [Step 4] 참고 음악 선택 페이지
 * 사용자가 참고 음악을 업로드하는 UI 컴포넌트
 * * ─────────────────────────────────────────────
 * TODO: API 연결 포인트 요약 (HuMix_API.pdf 기준)
 * ─────────────────────────────────────────────
 * [API-1] Presigned URL 발급
 * POST /api/v1/upload/audio/presigned
 * Body: { audio_name, content_type, usage: "REFERENCE" }
 * * [API-2] S3 직접 업로드
 * PUT {presigned_url}
 * Body: 파일 바이너리 (FormData 아님, 파일 객체 그대로)
 * * [API-3] 업로드 완료 후 DB 저장
 * POST /api/v1/upload/reference-tracks
 * Body: { file_key, audio_name, duration_seconds }
 * → reference_track_id 반환 (이후 곡 생성 요청 시 사용)
 * ─────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from "react";
import Stepper from "../components/Stepper";

export default function ReferenceUpload() {
  // ── 상태 관리 ──────────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // TODO: [API-3] 업로드 완료 후 서버에서 받은 reference_track_id 저장
  // const [referenceTrackId, setReferenceTrackId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav"];
  const MAX_SIZE_MB = 50;

  // ── 파일 유효성 검사 & 업로드 처리 ─────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    // 파일 형식 체크 (MIME 타입 또는 확장자)
    const isValidType =
      ACCEPTED_TYPES.includes(file.type) || file.name.match(/\.(mp3|wav)$/i);
    if (!isValidType) {
      alert("MP3 또는 WAV 파일만 업로드할 수 있어요.");
      return;
    }
    // 파일 크기 체크
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert("파일 크기는 최대 50MB까지 가능해요.");
      return;
    }

    setUploadedFile(file);
    setUploadDone(false);
    setUploadProgress(0);
    setIsUploading(true);

    // ──────────────────────────────────────────────────────────────────────────
    // TODO: 실제 API 연결 시 아래 시뮬레이션 코드를 제거하고
    //       아래 흐름으로 교체하세요:
    //
    //   1) [API-1] Presigned URL 발급
    //      const { presigned_url, file_key } = await fetch('/api/v1/upload/audio/presigned', {
    //        method: 'POST',
    //        headers: { 'Content-Type': 'application/json' },
    //        body: JSON.stringify({
    //          audio_name: file.name,
    //          content_type: file.type,  // 'audio/mpeg' or 'audio/wav'
    //          usage: 'REFERENCE',
    //        }),
    //      }).then(r => r.json());
    //
    //   2) [API-2] S3 직접 업로드 (FormData 아님! 파일 객체 그대로)
    //      await fetch(presigned_url, {
    //        method: 'PUT',
    //        headers: { 'Content-Type': file.type },
    //        body: file,
    //      });
    //
    //   3) [API-3] DB 저장 요청
    //      const { reference_track_id } = await fetch('/api/v1/upload/reference-tracks', {
    //        method: 'POST',
    //        headers: { 'Content-Type': 'application/json' },
    //        body: JSON.stringify({
    //          file_key,
    //          audio_name: file.name,
    //          duration_seconds: 0, // TODO: 오디오 재생 시간 파싱 필요 (AudioContext 활용)
    //        }),
    //      }).then(r => r.json());
    //
    //      setReferenceTrackId(reference_track_id); // 전역 상태(Zustand)에도 저장 필요
    //      setUploadDone(true);
    // ──────────────────────────────────────────────────────────────────────────

    // ── [임시] 업로드 진행률 시뮬레이션 (API 연결 전 UI 확인용) ──────────────
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 18 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsUploading(false);
        setUploadDone(true);
      }
      setUploadProgress(Math.min(progress, 100));
    }, 120);
    // ── [임시] 시뮬레이션 끝 ─────────────────────────────────────────────────
  }, []);

  // ── 드래그앤드롭 이벤트 핸들러 ─────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── 파일 input change 핸들러 ───────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── 파일 제거 ──────────────────────────────────────────────────────────────
  const handleRemove = () => {
    setUploadedFile(null);
    setUploadDone(false);
    setUploadProgress(0);
    setIsUploading(false);
    // TODO: referenceTrackId 초기화도 필요
    // setReferenceTrackId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── 파일 크기 포맷팅 유틸 ─────────────────────────────────────────────────
  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── 다음 버튼 활성화 조건 ─────────────────────────────────────────────────
  // 파일 미선택(건너뛰기) 또는 업로드 완료된 경우에만 활성화
  const canProceed = !uploadedFile || uploadDone;

  // ── 다음 단계 이동 핸들러 ─────────────────────────────────────────────────
  const handleNext = () => {
    // TODO: React Router navigate('/generation') 또는 상위 컴포넌트 step 변경
    // TODO: Zustand store에 referenceTrackId 저장 후 이동
    //   useStore.getState().setReferenceTrackId(referenceTrackId);
    //   navigate('/generation');
    console.log("다음: AI 생성 페이지로 이동");
    console.log("reference_track_id:", null); // TODO: 실제 ID로 교체
  };

  // ── 건너뛰기 핸들러 ──────────────────────────────────────────────────────
  const handleSkip = () => {
    // TODO: 참고 음악 없이 AI 생성 페이지로 이동
    // TODO: Zustand store의 referenceTrackId는 null로 유지
    //   navigate('/generation');
    console.log("건너뛰기: 참고 음악 없이 진행");
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* ── Stepper (Step 4: 스타일) ── */}
        <div className="w-full bg-[#1A1D24] rounded-lg p-5 border border-gray-800 shadow-sm flex items-center justify-center">
          <Stepper currentStep={4} />
        </div>
        <br />

        {/* ── 페이지 타이틀 ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">참고 음악 선택</h1>
          <p className="text-sm text-gray-500">
            참고 음악을 업로드해 음색과 분위기를 반영하세요
          </p>
        </div>

        {/* ── 메인 카드 ── */}
        <div className="bg-[#15171C] border border-gray-800 rounded-xl p-6 shadow-xl">
          {/* ── 드래그앤드롭 업로드 영역 ── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploadedFile && fileInputRef.current?.click()}
            className={`
              relative w-full rounded-xl border-2 border-dashed
              flex flex-col items-center justify-center
              transition-all duration-300 select-none
              ${uploadedFile ? "py-8 cursor-default" : "py-16 cursor-pointer"}
              ${
                isDragging
                  ? "border-purple-400 bg-purple-500/10 scale-[1.01]"
                  : uploadedFile
                    ? "border-purple-700/60 bg-[#1a1730]/60"
                    : "border-gray-700 bg-[#0f1015] hover:border-purple-600/60 hover:bg-purple-500/5"
              }
            `}
          >
            {/* 드래그 오버 시 글로우 효과 */}
            {isDragging && (
              <div className="absolute inset-0 rounded-xl pointer-events-none bg-purple-500/5 shadow-[inset_0_0_40px_rgba(139,92,246,0.15)]" />
            )}

            {/* 숨겨진 파일 input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              className="hidden"
              onChange={handleInputChange}
            />

            {/* ── 빈 상태 (파일 미선택) ── */}
            {!uploadedFile ? (
              <>
                {/* 음악 아이콘 — Concept.tsx K-POP 카드 아이콘과 동일한 🎵 이모지 사용 */}
                <div
                  className={`mb-5 transition-transform duration-300 text-5xl ${isDragging ? "scale-110" : ""}`}
                >
                  🎵
                </div>

                <p className="text-lg font-semibold text-white mb-2">
                  {isDragging ? "여기에 놓으세요" : "참고 음악 업로드"}
                </p>
                <p className="text-sm text-gray-500 mb-1">
                  MP3, WAV 파일을 드래그하거나 클릭해 선택하세요
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  최대 30초 · 최대 50MB
                </p>

                {/* 파일 선택 버튼 — 스텝퍼 완료 단계 색상(#8B5CF6)과 통일 */}
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold transition-colors duration-200 shadow-lg shadow-[#8B5CF6]/30 flex items-center gap-2"
                >
                  <span>📁</span> 파일 선택
                </button>
              </>
            ) : (
              /* ── 파일 선택 후 상태 ── */
              <div
                className="w-full max-w-lg px-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 파일 정보 행 */}
                <div className="flex items-center gap-4 mb-4">
                  {/* 음악 아이콘 */}
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-purple-400"
                    >
                      <path
                        d="M9 18V6l12-3v12M9 18C9 19.657 7.657 21 6 21C4.343 21 3 19.657 3 18C3 16.343 4.343 15 6 15C7.657 15 9 16.343 9 18ZM21 15C21 16.657 19.657 18 18 18C16.343 18 15 16.657 15 15C15 13.343 16.343 12 18 12C19.657 12 21 13.343 21 15Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* 파일명 & 크기 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatBytes(uploadedFile.size)}
                    </p>
                  </div>

                  {/* 완료 뱃지 / 퍼센트 / 삭제 버튼 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {uploadDone && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 text-xs font-medium">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        완료
                      </span>
                    )}
                    {isUploading && (
                      <span className="text-xs text-purple-400 font-medium tabular-nums">
                        {Math.round(uploadProgress)}%
                      </span>
                    )}
                    {/* 파일 제거 버튼 */}
                    <button
                      onClick={handleRemove}
                      className="w-7 h-7 rounded-full bg-gray-800 hover:bg-red-900/50 hover:text-red-400 text-gray-500 flex items-center justify-center transition-colors duration-200 text-sm"
                      title="파일 제거"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 진행률 바: 업로드 중(보라) → 완료(에메랄드) */}
                {(isUploading || uploadDone) && (
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        uploadDone ? "bg-emerald-500" : "bg-purple-500"
                      }`}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {/* 다른 파일 선택 링크 */}
                {uploadDone && (
                  <button
                    onClick={() => {
                      handleRemove();
                      setTimeout(() => fileInputRef.current?.click(), 50);
                    }}
                    className="mt-3 text-xs text-gray-500 hover:text-purple-400 transition-colors duration-200 underline underline-offset-2"
                  >
                    다른 파일 선택
                  </button>
                )}
              </div>
            )}
          </div>
          {/* ── 드래그앤드롭 영역 끝 ── */}

          {/* ── 업로드 가이드 ── */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5">
            {[
              "원하는 음색의 곡을 선택",
              "최대 30초 구간 분석",
              "선택 사항 (건너뛰기 가능)",
            ].map((tip) => (
              <p
                key={tip}
                className="text-xs text-gray-600 flex items-center gap-1.5"
              >
                <span className="text-purple-500/70">✓</span> {tip}
              </p>
            ))}
          </div>

          {/* ── 하단 버튼 영역 ── */}
          {/*
           * 배치 이유:
           * 업로드 박스 오른쪽 아래 정렬 → 시선이 업로드 완료 후 자연스럽게 버튼으로 이동
           * 건너뛰기는 시각적 무게를 낮게(텍스트 스타일), 다음 버튼은 주요 액션으로 강조
           */}
          <div className="mt-8 flex justify-end gap-3">
            {/* 건너뛰기 버튼 — 참고 음악 없이 AI 생성으로 바로 이동 */}
            <button
              onClick={handleSkip}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-300 bg-transparent hover:bg-white/5 border border-transparent hover:border-gray-700 transition-all duration-200"
            >
              건너뛰기
            </button>

            {/* 다음: AI 생성 버튼 — 스텝퍼 완료 단계 색상(#8B5CF6)과 통일
             * - 파일 미선택 상태: 활성 (건너뛰기와 동일하게 바로 진행 가능)
             * - 업로드 중: 비활성 (진행 중에는 이동 불가)
             * - 업로드 완료: 활성
             * TODO: 클릭 시 navigate('/generation') 연결 필요
             */}
            <button
              onClick={handleNext}
              // 수정됨: isUploading 대신 선언해둔 canProceed 변수를 사용하여 논리를 명확히 함
              disabled={!canProceed}
              className={`
                px-7 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-lg
                ${
                  !canProceed // 수정됨: canProceed가 false일 때(업로드 중일 때) 비활성화 스타일 적용
                    ? "bg-[#8B5CF6]/40 text-white/50 cursor-not-allowed"
                    : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[#8B5CF6]/30"
                }
              `}
            >
              다음: AI 생성 →
            </button>
          </div>
          {/* ── 하단 버튼 영역 끝 ── */}
        </div>
        {/* ── 메인 카드 끝 ── */}
      </div>
    </div>
  );
}
