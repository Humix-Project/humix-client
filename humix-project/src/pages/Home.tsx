import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── 창작 흐름 데이터 ────────────────────────────────────────────────
const STEPS_DATA = [
  {
    step: "STEP 01",
    icon: "🎤",
    title: "허밍 녹음",
    desc: "머릿속 멜로디를 허밍으로 녹음. 3초~60초, 부분 재녹음 지원.",
    tag: "Web Audio API",
    cardBorder: "hover:border-[#7c5cfc]/40",
    iconBg: "bg-[#7c5cfc]/15",
    tagStyle: "text-[#a78bfa] bg-[#7c5cfc]/12 border-[#7c5cfc]/25",
  },
  {
    step: "STEP 02",
    icon: "📊",
    title: "멜로디 벡터 변환",
    desc: "pYIN 알고리즘으로 F0 추출 후 MIDI 시퀀스로 자동 변환.",
    tag: "FastAPI · Librosa",
    cardBorder: "hover:border-[#22d3ee]/40",
    iconBg: "bg-[#22d3ee]/15",
    tagStyle: "text-[#22d3ee] bg-[#22d3ee]/12 border-[#22d3ee]/25",
  },
  {
    step: "STEP 03",
    icon: "✏️",
    title: "시각적 편집",
    desc: "Pitch Curve 드래그로 음정·타이밍 수정. 음계 스냅 지원.",
    tag: "Canvas · Tone.js",
    cardBorder: "hover:border-[#f472b6]/40",
    iconBg: "bg-[#f472b6]/15",
    tagStyle: "text-[#f472b6] bg-[#f472b6]/12 border-[#f472b6]/25",
  },
  {
    step: "STEP 04",
    icon: "🎨",
    title: "컨셉 설정",
    desc: "장르(K-POP, Jazz 등)와 분위기(V-A 모델) 선택.",
    tag: "Valence-Arousal",
    cardBorder: "hover:border-[#7c5cfc]/40",
    iconBg: "bg-[#facc15]/15",
    tagStyle: "text-[#a78bfa] bg-[#7c5cfc]/12 border-[#7c5cfc]/25",
  },
  {
    step: "STEP 05",
    icon: "🎸",
    title: "오디오 스타일 참조",
    desc: "참고 음악 업로드 → 음색·공간감 분석 후 반영.",
    tag: "Style Transfer",
    cardBorder: "hover:border-[#34d399]/40",
    iconBg: "bg-[#34d399]/15",
    tagStyle: "text-[#34d399] bg-[#34d399]/12 border-[#34d399]/25",
  },
  {
    step: "STEP 06",
    icon: "🤖",
    title: "AI 곡 완성",
    desc: "MusicGen이 멜로디 중심으로 반주·구조 생성. SSE 진행률.",
    tag: "MusicGen · PyTorch",
    cardBorder: "hover:border-[#fb923c]/40",
    iconBg: "bg-[#fb923c]/15",
    tagStyle: "text-[#fb923c] bg-[#fb923c]/12 border-[#fb923c]/25",
  },
];

// ── 최근 프로젝트 데이터 (MyProject 스타일의 메타 구조로 동기화) ──
interface Project {
  id: number;
  icon: string;
  name: string;
  meta: string;
  genre: string;
  duration: string;
}

const RECENT_PROJECTS: Project[] = [
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

// 장르별 스타일 딕셔너리 매핑
const GENRE_STYLES: Record<
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
            일상의 가벼운 허밍을 풍성한 한 편의 음악으로.
            <br />
            당신의 감정을 담아, 언제나 꿈꿔왔던
            <br />
            나만의 음악 세계를 펼쳐보세요.
          </p>

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => navigate("/create-music")}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: "#7C4DFF",
                boxShadow: "0 4px 24px rgba(168,85,247,0.4)",
                fontSize: "15px",
              }}
            >
              <span>🎤</span>
              Start Humming
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
      <section className="relative px-16 py-16 max-w-7xl mx-auto w-full z-10">
        <div className="mb-7">
          <h2 className="text-xl font-bold tracking-tight text-white">
            창작 흐름
          </h2>
          <p className="text-xs text-[#5a5a70]">
            6단계로 나만의 음악을 완성하세요
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEPS_DATA.map((s) => (
            <div
              key={s.step}
              className={`flex flex-col gap-4 p-5.5 bg-[#111118] border border-white/5 rounded-2xl cursor-default transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#18181f] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${s.cardBorder}`}
            >
              <span className="text-[10px] font-bold tracking-wider text-[#5a5a70]">
                {s.step}
              </span>

              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${s.iconBg}`}
              >
                {s.icon}
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">{s.title}</h3>
                <p className="text-xs text-[#9090a8] leading-relaxed">
                  {s.desc}
                </p>
              </div>

              <div
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border w-fit ${s.tagStyle}`}
              >
                {s.tag}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          최근 프로젝트 SECTION (MyProject 디자인 적용 완료)
         ══════════════════════════════════════ */}
      <section className="relative px-16 py-16 max-w-7xl mx-auto w-full z-10">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              최근 프로젝트
            </h2>
            <p className="text-xs text-[#5a5a70]">최근에 생성한 트랙 목록</p>
          </div>
          <button
            onClick={() => navigate("/my-project")}
            className="text-xs font-semibold text-[#a78bfa] hover:text-[#c084fc] transition-colors duration-150"
          >
            전체 보기 →
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {RECENT_PROJECTS.map((p) => {
            const isPlaying = playingId === p.id;
            const style = GENRE_STYLES[p.genre] || GENRE_STYLES["K-POP"];

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
          })}
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
