import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: number;
  icon: string;
  name: string;
  meta: string;
  genre: string;
  duration: string;
}

const ALL_PROJECTS: Project[] = [
  {
    id: 1,
    icon: "🎵",
    name: "summer_melody_v3",
    meta: "K-POP · BPM 128 · 2026.05.28 · 허밍 8.0s → 생성 1:45",
    genre: "K-POP",
    duration: "2:00",
  },
  {
    id: 2,
    icon: "🎷",
    name: "rainy_cafe_jazz",
    meta: "Jazz · BPM 76 · 2026.05.25 · 허밍 12.0s → 생성 1:30",
    genre: "Jazz",
    duration: "1:45",
  },
  {
    id: 3,
    icon: "🎬",
    name: "epic_intro_cinematic",
    meta: "Cinematic · BPM 92 · 2026.05.20 · 허밍 6.5s → 생성 1:20",
    genre: "Cinematic",
    duration: "1:30",
  },
];

const GENRE_FILTERS = ["전체", "K-POP", "Jazz", "Cinematic"];

export default function MyProject() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>("전체");
  const [playingId, setPlayingId] = useState<number | null>(null);

  const filtered =
    activeFilter === "전체"
      ? ALL_PROJECTS
      : ALL_PROJECTS.filter((p) => p.genre === activeFilter);

  // 장르별 배지 및 썸네일 스타일 매핑 딕셔너리
  const genreStyles: Record<
    string,
    { bg: string; text: string; border: string; thumb: string }
  > = {
    "K-POP": {
      bg: "bg-[#7c5cfc]/12",
      text: "text-[#a78bfa]",
      border: "border-[#7c5cfc]/25",
      thumb: "bg-[#7c5cfc]/15",
    },
    Jazz: {
      bg: "bg-[#22d3ee]/12",
      text: "text-[#22d3ee]",
      border: "border-[#22d3ee]/25",
      thumb: "bg-[#22d3ee]/12",
    },
    Cinematic: {
      bg: "bg-[#f472b6]/12",
      text: "text-[#f472b6]",
      border: "border-[#f472b6]/25",
      thumb: "bg-[#f472b6]/12",
    },
  };

  return (
    <div className="relative flex-1 p-10 md:px-16 md:py-16 text-[#f0f0f8] bg-[#0a0a0f]">
      {/* Ambient 오로라 가우시안 블러 배경 */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_50%_at_60%_0%,rgba(124,92,252,0.12)_0%,transparent_70%),radial-gradient(ellipse_40%_60%_at_100%_50%,rgba(244,114,182,0.07)_0%,transparent_70%)] opacity-60" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* 타이틀 헤더 */}
        <div className="mb-7">
          <h1 className="text-lg font-bold tracking-tight text-[#f0f0f8]">
            내 프로젝트
          </h1>
          <p className="text-xs text-[#5a5a70]">생성한 음악 전체 목록</p>
        </div>

        {/* 상단 필터 바 및 새 프로젝트 버튼 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-white/5">
          <div className="flex flex-wrap gap-1.5">
            {GENRE_FILTERS.map((f) => {
              const isActive = activeFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border ${
                    isActive
                      ? "bg-[#7c5cfc]/15 text-[#a78bfa] border-[#7c5cfc]/30"
                      : "bg-[#18181f] text-[#9090a8] border-white/5 hover:bg-[#1e1e28] hover:text-[#f0f0f8]"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => navigate("/create-music")}
            className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-white text-xs bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-lg shadow-[#8B5CF6]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_28px_rgba(124,92,252,0.35)]"
          >
            + 새 프로젝트
          </button>
        </div>

        {/* 프로젝트 트랙 리스트 */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-[#111118] border border-white/5 rounded-2xl text-center">
              <p className="text-xs text-[#5a5a70]">
                해당 장르의 프로젝트가 없습니다.
              </p>
            </div>
          ) : (
            filtered.map((p) => {
              const isPlaying = playingId === p.id;
              const style = genreStyles[p.genre] || genreStyles["K-POP"];

              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-4 px-5 py-4 bg-[#18181f] border border-white/5 rounded-xl transition-all duration-200 hover:bg-[#1e1e28] hover:border-[#7c5cfc]/35 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                >
                  {/* 트랙 썸네일 */}
                  <div
                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${style.thumb}`}
                  >
                    {p.icon}
                  </div>

                  {/* 트랙 메타 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#f0f0f8] mb-0.5 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-[#9090a8] truncate">
                      {p.meta}
                    </div>
                  </div>

                  {/* 장르 배지 */}
                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                  >
                    {p.genre}
                  </span>

                  {/* 재생 시간 */}
                  <div className="shrink-0 text-xs text-[#5a5a70] w-9 text-right font-medium">
                    {p.duration}
                  </div>

                  {/* 재생 버튼 */}
                  <button
                    onClick={() => setPlayingId(isPlaying ? null : p.id)}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[10px] border transition-all duration-200 hover:scale-105 ${
                      isPlaying
                        ? "bg-gradient-to-r from-[#7c5cfc] to-[#9d5cf5] border-transparent text-white shadow-[0_0_12px_rgba(124,92,252,0.35)]"
                        : "bg-[#1e1e28] border-white/5 text-[#9090a8] group-hover:bg-[#7c5cfc] group-hover:border-transparent group-hover:text-white"
                    }`}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
