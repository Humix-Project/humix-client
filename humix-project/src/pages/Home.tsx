import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── 창작 흐름 데이터 ──────────────────────────────────────────
const STEPS_DATA = [
  {
    step: "STEP 01",
    icon: "🎤",
    iconBg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    title: "허밍 녹음",
    desc: "머릿속 멜로디를 허밍으로 녹음. 3초~60초, 부분 재녹음 지원.",
    tag: "Web Audio API",
    tagColor: "#7c3aed",
  },
  {
    step: "STEP 02",
    icon: "📊",
    iconBg: "linear-gradient(135deg, #0ea5e9, #22c55e)",
    title: "멜로디 벡터 변환",
    desc: "pYIN 알고리즘으로 F0 추출 후 MIDI 시퀀스로 자동 변환.",
    tag: "FastAPI · Librosa",
    tagColor: "#0891b2",
  },
  {
    step: "STEP 03",
    icon: "✏️",
    iconBg: "linear-gradient(135deg, #ec4899, #a855f7)",
    title: "시각적 편집",
    desc: "Pitch Curve 드래그로 음정·타이밍 수정. 음계 스냅 지원.",
    tag: "Canvas · Tone.js",
    tagColor: "#be185d",
  },
  {
    step: "STEP 04",
    icon: "🎨",
    iconBg: "linear-gradient(135deg, #f59e0b, #ef4444)",
    title: "컨셉 설정",
    desc: "장르(K-POP, Jazz 등)와 분위기(V-A 모델) 선택.",
    tag: "Valence-Arousal",
    tagColor: "#b45309",
  },
  {
    step: "STEP 05",
    icon: "🎸",
    iconBg: "linear-gradient(135deg, #10b981, #059669)",
    title: "오디오 스타일 참조",
    desc: "참고 음악 업로드 → 음색·공간감 분석 후 반영.",
    tag: "Style Transfer",
    tagColor: "#047857",
  },
  {
    step: "STEP 06",
    icon: "🤖",
    iconBg: "linear-gradient(135deg, #f97316, #b45309)",
    title: "AI 곡 완성",
    desc: "MusicGen이 멜로디 중심으로 반주·구조 생성. SSE 진행률.",
    tag: "MusicGen · PyTorch",
    tagColor: "#c2410c",
  },
];

// ── 최근 프로젝트 데이터 ──────────────────────────────────────
const RECENT_PROJECTS = [
  {
    id: 1,
    icon: "🎵",
    iconBg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    name: "summer_melody_v3",
    meta: "K-POP · BPM 128 · 2026.05.28",
    genre: "K-POP",
    genreColor: "#6366f1",
    duration: "2:00",
  },
  {
    id: 2,
    icon: "🎷",
    iconBg: "linear-gradient(135deg, #10b981, #0ea5e9)",
    name: "rainy_cafe_jazz",
    meta: "Jazz · BPM 76 · 2026.05.25",
    genre: "Jazz",
    genreColor: "#0891b2",
    duration: "1:45",
  },
  {
    id: 3,
    icon: "🎬",
    iconBg: "linear-gradient(135deg, #ec4899, #7c3aed)",
    name: "epic_intro_cinematic",
    meta: "Cinematic · BPM 92 · 2026.05.20",
    genre: "Cinematic",
    genreColor: "#be185d",
    duration: "1:30",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const animate = () => {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            clearInterval(interval);
            return 85;
          }
          return prev + Math.random() * 4;
        });
      }, 120);
      progressRef.current = interval;
    };
    animate();
    const loop = setInterval(animate, 5000);
    return () => {
      clearInterval(loop);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  return (
    <div className="relative bg-black overflow-x-hidden flex flex-col">
      {/* Ambient blobs */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "-120px",
          left: "-80px",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none fixed"
        style={{
          bottom: "0",
          right: "-60px",
          width: "320px",
          height: "320px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
          zIndex: 0,
        }}
      />

      {/* ══════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════ */}
      <section
        className="relative flex items-center justify-between px-16 pt-16 pb-20 max-w-7xl mx-auto w-full gap-8"
        style={{ minHeight: "100vh", zIndex: 1 }}
      >
        {/* Left */}
        <div className="flex flex-col gap-6 max-w-130 animate-fadein">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full w-fit"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ fontSize: "13px" }}>🎵</span>
            <span
              className="text-xs font-medium tracking-wide"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              AI Music Generation
            </span>
          </div>

          <div>
            <h1
              className="font-extrabold leading-tight"
              style={{
                fontSize: "clamp(2.6rem, 5vw, 4rem)",
                letterSpacing: "-0.02em",
                color: "#ffffff",
              }}
            >
              Mix your
            </h1>
            <h1
              className="font-extrabold leading-tight"
              style={{
                fontSize: "clamp(2.6rem, 5vw, 4rem)",
                letterSpacing: "-0.02em",
              }}
            >
              <span
                style={{
                  background: "linear-gradient(135deg, #c084fc, #f472b6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Hum
              </span>
              <span style={{ color: "#ffffff" }}> into Art.</span>
            </h1>
          </div>

          <p
            className="text-base leading-relaxed max-w-100"
            style={{ color: "rgba(255,255,255,0.52)" }}
          >
            Turn your everyday humming into fully orchestrated tracks.
            <br />
            Express your mood, capture a moment, and become the
            <br />
            artist you've always wanted to be.
          </p>

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => navigate("/create-music")}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                boxShadow: "0 4px 24px rgba(168,85,247,0.4)",
                fontSize: "15px",
              }}
            >
              <span>🎤</span>
              Start Humming
            </button>
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-200 hover:bg-white/10 active:scale-95"
              style={{
                color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.15)",
                fontSize: "15px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  border: "1.5px solid rgba(255,255,255,0.55)",
                  fontSize: "9px",
                }}
              >
                ▶
              </span>
              How it works
            </button>
          </div>
        </div>

        {/* Right: Visual card */}
        <div
          className="relative shrink-0 flex flex-col items-center justify-end animate-fadein-delay"
          style={{ width: "340px" }}
        >
          <div
            className="relative rounded-3xl overflow-hidden flex items-center justify-center"
            style={{
              width: "340px",
              height: "300px",
              background:
                "linear-gradient(145deg, rgba(168,85,247,0.12) 0%, rgba(236,72,153,0.08) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            <img
              src="/home-image/home-humix.png"
              alt="humix visual"
              style={{
                width: "85%",
                height: "85%",
                objectFit: "contain",
                filter: "drop-shadow(0 8px 32px rgba(168,85,247,0.55))",
              }}
            />
          </div>

          {/* Analyzing bar */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{
              width: "300px",
              background: "rgba(18,18,24,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(168,85,247,0.2)" }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: "#a855f7",
                  boxShadow: "0 0 6px #a855f7",
                  animation: "hpulse 1.5s ease-in-out infinite",
                }}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span
                className="text-xs font-medium"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Analyzing melody...
              </span>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: "3px", background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #a855f7, #ec4899)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          창작 흐름 SECTION
      ══════════════════════════════════════ */}
      <section
        className="relative px-16 py-16 max-w-7xl mx-auto w-full"
        style={{ zIndex: 1 }}
      >
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">창작 흐름</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            6단계로 나만의 음악을 완성하세요
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {STEPS_DATA.map((s) => (
            <div
              key={s.step}
              className="flex flex-col gap-4 p-6 rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:border-white/15"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Step label */}
              <span
                className="text-xs font-semibold tracking-widest"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {s.step}
              </span>

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                style={{ background: s.iconBg }}
              >
                {s.icon}
              </div>

              {/* Title & desc */}
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  {s.title}
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {s.desc}
                </p>
              </div>

              {/* Tech tag */}
              <div
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium w-fit"
                style={{
                  background: `${s.tagColor}22`,
                  color: s.tagColor,
                  border: `1px solid ${s.tagColor}44`,
                }}
              >
                {s.tag}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          최근 프로젝트 SECTION
      ══════════════════════════════════════ */}
      <section
        className="relative px-16 py-16 max-w-7xl mx-auto w-full"
        style={{ zIndex: 1 }}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">최근 프로젝트</h2>
          <button
            onClick={() => navigate("/my-project")}
            className="text-sm font-medium transition-colors duration-150 hover:text-white"
            style={{ color: "rgba(168,85,247,0.85)" }}
          >
            전체 보기 →
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {RECENT_PROJECTS.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:scale-[1.005] group"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Icon */}
              <div
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-lg"
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
                  style={{ color: "rgba(255,255,255,0.38)" }}
                >
                  {p.meta}
                </span>
              </div>

              {/* Genre badge */}
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold shrink-0"
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
                className="text-sm font-medium shrink-0"
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
          ))}
        </div>
      </section>

      {/* bottom padding */}
      <div className="h-16" />

      <style>{`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadein-delay {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .animate-fadein { animation: fadein 0.7s ease forwards; }
        .animate-fadein-delay { animation: fadein-delay 0.9s 0.15s ease both; }
      `}</style>
    </div>
  );
}
