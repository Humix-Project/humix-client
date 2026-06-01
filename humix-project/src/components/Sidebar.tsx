import { useState } from "react";

interface NavItem {
  icon: string;
  label: string;
  href?: string;
}

const navItems: NavItem[] = [
  { icon: "/nav-icon/home.png", label: "홈" },
  { icon: "/nav-icon/my-project.png", label: "내 프로젝트" },
  { icon: "/nav-icon/create-music.png", label: "음악 만들기" },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside
      className={`
        h-screen bg-black flex flex-col
        transition-all duration-300 ease-in-out
        border-r border-white/10
        ${isOpen ? "w-52" : "w-14"}
      `}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-3 py-4 cursor-pointer select-none"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? "사이드바 닫기" : "사이드바 열기"}
      >
        <img
          src="/logo/icon.png"
          alt="HumMix"
          className="w-8 h-8 rounded-full shrink-0"
        />
        <span
          className={`
            text-white font-semibold text-sm whitespace-nowrap
            transition-all duration-300 ease-in-out
            ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}
          `}
        >
          <img
            src="/logo/logo.png"
            alt="HumMix"
            className="w-20 h-20 rounded-full shrink-0"
          />
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 px-2 mt-2">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href ?? "#"}
            className={`
              flex items-center gap-3 px-2 py-2.5 rounded-lg
              text-white/70 hover:text-white hover:bg-white/10
              transition-all duration-200
              ${isOpen ? "" : "justify-center"}
            `}
          >
            <img
              src={item.icon}
              alt={item.label}
              className="w-5 h-5 shrink-0 opacity-70 group-hover:opacity-100"
            />
            <span
              className={`
                text-sm whitespace-nowrap text-white/70
                transition-all duration-300 ease-in-out
                ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}
              `}
            >
              {item.label}
            </span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
