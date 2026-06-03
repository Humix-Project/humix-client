import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ALL_PROJECTS = [
  {
    id: 1,
    icon: "🎵",
    iconBg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    name: "summer_melody_v3",
    meta: "K-POP · BPM 128 · 2026.05.28 · 허밍 8.0s → 생성 1:45",
    genre: "K-POP",
    genreColor: "#6366f1",
    duration: "2:00",
  },
  {
    id: 2,
    icon: "🎷",
    iconBg: "linear-gradient(135deg, #10b981, #0ea5e9)",
    name: "rainy_cafe_jazz",
    meta: "Jazz · BPM 76 · 2026.05.25 · 허밍 12.0s → 생성 1:30",
    genre: "Jazz",
    genreColor: "#0891b2",
    duration: "1:45",
  },
  {
    id: 3,
    icon: "🎬",
    iconBg: "linear-gradient(135deg, #ec4899, #7c3aed)",
    name: "epic_intro_cinematic",
    meta: "Cinematic · BPM 92 · 2026.05.20 · 허밍 6.5s → 생성 1:20",
    genre: "Cinematic",
    genreColor: "#be185d",
    duration: "1:30",
  },
];

const GENRE_FILTERS = ["전체", "K-POP", "Jazz", "Cinematic"];

export default function MyProject() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("전체");
  const [playingId, setPlayingId] = useState<number | null>(null);

  const filtered =
    activeFilter === "전체"
      ? ALL_PROJECTS
      : ALL_PROJECTS.filter((p) => p.genre === activeFilter);

  return (
    <div className="relative min-h-screen bg-black px-12 py-12">
      {/* Ambient blob */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "-100px",
          left: "-60px",
          width: "380px",
          height: "380px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          zIndex: 0,
        }}
      />

      <div className="relative max-w-5xl mx-auto" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">내 프로젝트</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
            생성한 음악 전체 목록
          </p>
        </div>

        {/* Filter bar + New button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {GENRE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                style={
                  activeFilter === f
                    ? {
                        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                        color: "#ffffff",
                        border: "1px solid transparent",
                      }
                    : {
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }
                }
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate("/create-music")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
            }}
          >
            + 새 프로젝트
          </button>
        </div>

        {/* Project list */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <div
              className="flex items-center justify-center py-20 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                해당 장르의 프로젝트가 없습니다.
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.003]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* Icon */}
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: p.iconBg }}
                >
                  {p.icon}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-sm font-semibold text-white">
                    {p.name}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {p.meta}
                  </span>
                </div>

                {/* Genre badge */}
                <div
                  className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: `${p.genreColor}22`,
                    color: p.genreColor,
                    border: `1px solid ${p.genreColor}44`,
                  }}
                >
                  {p.genre}
                </div>

                {/* Duration */}
                <span
                  className="shrink-0 text-sm font-medium"
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    minWidth: "36px",
                    textAlign: "right",
                  }}
                >
                  {p.duration}
                </span>

                {/* Play button */}
                <button
                  onClick={() => setPlayingId(playingId === p.id ? null : p.id)}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                  style={{
                    background:
                      playingId === p.id
                        ? "linear-gradient(135deg, #a855f7, #ec4899)"
                        : "rgba(255,255,255,0.1)",
                    color: "white",
                    fontSize: "11px",
                  }}
                >
                  {playingId === p.id ? "⏸" : "▶"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
