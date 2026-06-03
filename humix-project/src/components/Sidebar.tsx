import { useState } from "react";
import { NavLink } from "react-router-dom";

interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: number; // 내 프로젝트 우측에 들어갈 숫자 배지
}

interface NavSection {
  sectionTitle: string;
  items: NavItem[];
}

// ── 원래 목록을 유지하면서 3개 섹션 그룹으로 분리 ──────────────────
const navSections: NavSection[] = [
  {
    sectionTitle: "메인",
    items: [
      { icon: "/nav-icon/home.png", label: "홈", href: "/" },
      {
        icon: "/nav-icon/my-project.png",
        label: "내 프로젝트",
        href: "/my-project",
        badge: 3,
      },
    ],
  },
  {
    sectionTitle: "창작 도구",
    items: [
      {
        icon: "/nav-icon/create-music.png",
        label: "음악 만들기",
        href: "/create-music",
      },
    ],
  },
  {
    sectionTitle: "둘러보기",
    items: [{ icon: "/nav-icon/faq.png", label: "FAQ", href: "/faq" }],
  },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  // Guest 유저 상태 정보 -> 로그인 기능 구현 후 실제걸로 대체해야됨
  const user = {
    name: "Guest_1234",
    plan: "무료 플랜",
  };

  return (
    <aside
      className={`
        h-screen bg-black flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        border-r border-white/10 select-none
        ${isOpen ? "w-52" : "w-14"}
      `}
    >
      {/* ── 로고 영역 ── */}
      <div
        className="flex items-center gap-3 px-3 py-4 cursor-pointer overflow-hidden"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? "사이드바 닫기" : "사이드바 열기"}
      >
        <img
          src="/logo/icon.png"
          alt="HumMix Icon"
          className="w-8 h-8 rounded-full shrink-0"
        />
        <span
          className={`
            text-white font-semibold text-sm whitespace-nowrap
            transition-all duration-300 ease-in-out
            ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"}
          `}
        >
          <img
            src="/logo/logo.png"
            alt="HumMix Text"
            className="h-15 w-20 object-contain shrink-0"
          />
        </span>
      </div>

      {/* ── 3개 섹션으로 나뉜 메뉴 리스트 ── */}
      <div className="flex-1 flex flex-col gap-5 px-2 mt-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navSections.map((section) => (
          <div key={section.sectionTitle} className="flex flex-col gap-0.5">
            {/* 섹션 타이틀 라벨 (사이드바가 열려있을 때만 노출) */}
            <span
              className={`
                text-[10px] font-bold text-white/30 px-3 mb-1.5 tracking-wider transition-all duration-200
                ${isOpen ? "opacity-100 block" : "opacity-0 hidden"}
              `}
            >
              {section.sectionTitle}
            </span>

            {/* 내부 아이템 렌더링 */}
            {section.items.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                end={item.href === "/"}
                title={!isOpen ? item.label : undefined}
                className={({ isActive }) => `
                  flex items-center justify-between px-2 py-2.5 rounded-lg
                  transition-all duration-200
                  ${isOpen ? "" : "justify-center"}
                  ${
                    isActive
                      ? "bg-purple-500/30 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-purple-500/20"
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 원래 사용하시던 원본 이미지 필터 조건 유지 */}
                      <img
                        src={item.icon}
                        alt={item.label}
                        className="w-5 h-5 shrink-0 transition-opacity duration-200"
                        style={{
                          filter: isActive
                            ? "brightness(0) invert(1)"
                            : "brightness(0) invert(0.7)",
                        }}
                      />
                      <span
                        className={`
                          text-sm whitespace-nowrap transition-all duration-300 ease-in-out
                          ${isActive ? "text-white" : "text-white/70"}
                          ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}
                        `}
                      >
                        {item.label}
                      </span>
                    </div>

                    {/* 내 프로젝트 우측의 보라색 숫자 배지 (사이드바 열렸을 때만) */}
                    {item.badge && isOpen && (
                      <span className="flex items-center justify-center text-[10px] font-bold w-4 h-4 rounded-full bg-purple-600 text-white shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* ── 최하단 고정 투명 로그인 유저 정보 카드 ── */}
      <div className="px-2 pb-4 pt-2 border-t border-white/5">
        <div
          title={!isOpen ? `${user.name} (${user.plan})` : undefined}
          className={`
            flex items-center gap-3 rounded-xl transition-all duration-300 overflow-hidden
            ${isOpen ? "p-3 bg-white/[0.04] border border-white/[0.06]" : "p-1.5 justify-center bg-transparent"}
          `}
        >
          <div
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-sm text-white select-none"
            style={{
              background: "linear-gradient(135deg, #818cf8, #38bdf8)",
              boxShadow: "0 2px 8px rgba(56, 189, 248, 0.2)",
            }}
          >
            {user.name.charAt(0)}
          </div>

          <div
            className={`
              flex flex-col flex-1 min-w-0 transition-all duration-200
              ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}
            `}
          >
            <span className="text-white text-xs font-semibold tracking-wide truncate">
              {user.name}
            </span>
            <span className="text-white/40 text-[10px] mt-0.5 font-medium">
              {user.plan}
            </span>
          </div>

          {isOpen && (
            <button className="text-white/30 hover:text-white/70 transition-colors shrink-0 p-0.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
