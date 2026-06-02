import { useState } from "react";
import { NavLink } from "react-router-dom";

interface NavItem {
  icon: string;
  label: string;
  href: string; // 필수 값으로 변경하는 것이 안전합니다.
}

// 1. 해결: 각 메뉴 클릭 시 이동할 올바른 경로(href) 지정
const navItems: NavItem[] = [
  { icon: "/nav-icon/home.png", label: "홈", href: "/" },
  {
    icon: "/nav-icon/my-project.png",
    label: "내 프로젝트",
    href: "/my-project",
  },
  {
    icon: "/nav-icon/create-music.png",
    label: "음악 만들기",
    href: "/create-music",
  },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside
      className={`
        h-screen bg-black flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        border-r border-white/10
        ${isOpen ? "w-52" : "w-14"}
      `}
    >
      {/* Logo - 3. 해결: overflow-hidden 추가하여 접힐 때 잔상 제거 */}
      <div
        className="flex items-center gap-3 px-3 py-4 cursor-pointer select-none overflow-hidden"
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
          {/* 2. 해결: 거대했던 w-20 h-20 로고 이미지 크기를 적절하게 조절 (또는 텍스트로 대체 가능) */}
          <img
            src="/logo/logo.png"
            alt="HumMix Text"
            className="h-5 object-contain shrink-0"
          />
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 px-2 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            // 팁: 메인 홈("/")이 다른 모든 서브 경로("/my-project" 등)와 중복 활성화되는 것을 막기 위해
            // 홈 메뉴일 때만 end 속성을 부여하는 것이 좋습니다.
            end={item.href === "/"}
            className={({ isActive }) => `
              flex items-center gap-3 px-2 py-2.5 rounded-lg
              transition-all duration-200
              ${isOpen ? "" : "justify-center"}
              ${
                isActive
                  ? "bg-white/20 text-white font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }
            `}
          >
            {({ isActive }) => (
              <>
                <img
                  src={item.icon}
                  alt={item.label}
                  className={`w-5 h-5 shrink-0 transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "opacity-70"
                  }`}
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
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
