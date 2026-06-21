import { useState } from "react";
// ✅ 추가: 게스트 계정 부여를 위해 useEffect 임포트 추가
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
// 🔌 API 연결: 게스트 로그인(access_token 발급)을 전담하는 스토어로 교체
// 기존에는 이 파일 안에서 로컬스토리지에 닉네임만 만들어 저장했지만,
// 실제 백엔드 인증(POST /api/v1/auth/guest-login)은 useAuthStore가 전담하도록 분리함.
// 이유: 발급받은 access_token은 Sidebar뿐 아니라 곡 생성(Generation.tsx) 등
//      다른 페이지에서도 공통으로 필요하기 때문에, 특정 컴포넌트에 가두지 않고
//      전역 스토어에서 관리해야 함.
import { useAuthStore } from "../store/useAuthStore";

//1. 네비게이션 아이템과 섹션 타입 정의
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

//2. 사이드바 컴포넌트 구현
export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  // 🔌 API 연결: Guest 유저 상태 정보를 useAuthStore에서 가져옴
  // - accessToken: 로그인 성공 여부 판단 및 다른 페이지에서 API 호출 시 사용
  // - loginAsGuest: 게스트 로그인 요청 함수 (POST /api/v1/auth/guest-login)
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginAsGuest = useAuthStore((state) => state.loginAsGuest);

  // ✅ 수정: 화면에 보여줄 닉네임은 기존처럼 로컬에서 생성/보관.
  // 비고: 이 닉네임은 명세서의 device_id와는 별개의 "화면 표시용" 값임.
  //       device_id(서버 인증용 UUID)는 useAuthStore 내부에서 별도로 관리됨.
  const [user, setUser] = useState({
    name: "",
    plan: "무료 플랜",
  });

  // ✅ 추가: 홈 화면 접속 시 게스트 계정을 자동 생성하고 로컬 스토리지에 저장하는 로직
  useEffect(() => {
    const storedGuestId = localStorage.getItem("humix_guest_id");

    if (storedGuestId) {
      // 1. 기존 방문 기록이 있으면 스토리지에서 가져옴
      setUser({ name: storedGuestId, plan: "무료 플랜" });
    } else {
      // 2. 첫 방문 시 UUID 텍스트 느낌으로 랜덤 4자리 코드를 만들어 즉시 부여 (버튼 클릭 동의 X)
      const randomCode = Math.random().toString(16).substring(2, 6);
      const newGuestName = `Guest_${randomCode}`;

      localStorage.setItem("humix_guest_id", newGuestName);
      setUser({ name: newGuestName, plan: "무료 플랜" });
    }
  }, []);

  // 🔌 API 연결: 앱 진입 시 실제 백엔드 게스트 로그인 요청 (access_token 발급)
  // 비고: 위의 닉네임 로직과는 별개로 동작함. 닉네임은 화면 표시용, 이 호출은 실제 인증용.
  //       loginAsGuest 내부에서 이미 토큰이 있거나 요청 중이면 중복 호출하지 않도록 가드되어 있음.
  useEffect(() => {
    loginAsGuest();
  }, [loginAsGuest]);

  return (
    // 전체 사이드바
    <aside
      className={`
        h-screen bg-black flex flex-col shrink-0
        transition-all duration-300 ease-in-out
        border-r border-white/10 select-none
        ${isOpen ? "w-52" : "w-16"}
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
          className="w-8 h-8 rounded-100 shrink-0"
        />
        <span
          className={`
            whitespace-nowrap
            transition-all duration-300 ease-in-out
            ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"}
          `}
        >
          <img
            src="/logo/logo.png"
            alt="HumMix logo"
            className="h-20 w-25 object-contain shrink-0"
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
                      ? "bg-violet-500/30 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-violet-500/20"
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 원본 이미지 필터 조건 유지 - 흰색변경 및 색 조정*/}
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
                      <span className="flex items-center justify-center text-[10px] font-bold w-4 h-4 rounded-full bg-violet-500 text-white shrink-0">
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
      {/* 이후에 user변수 생성 필요 */}
      {/* ✅ 수정: px-4 → px-2로 줄여 접혔을 때 동그라미 짤림 방지 */}
      <div className="px-2 pb-4 pt-2">
        {/* ✅ 추가: 유저 정보 박스 위에 영상처럼 얇은 선(border) 추가 */}
        <div className="border-t border-white/10 mb-3 w-full"></div>

        {/* ✅ 수정: 영역을 클릭할 수 있는 네모 박스(button) 형태로 변경하여 hover 효과를 주었습니다. */}
        {/* ✅ 수정: 접혔을 때 동그라미 중앙 정렬 + 텍스트 완전히 숨김 처리 */}
        <button
          title={!isOpen ? `${user.name} (${user.plan})` : undefined}
          className={`
            flex items-center gap-3 rounded-xl transition-all duration-300 text-left
            hover:bg-white/10 active:bg-white/5
            ${isOpen ? "w-full p-2.5" : "w-full p-2 justify-center"}
          `}
        >
          <div
            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-sm text-white select-none"
            // ✅ 수정: 하늘색 그라데이션을 걷어내고 기존 서비스의 보라색 테마를 사용했습니다.
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
              boxShadow: "0 2px 8px rgba(139, 92, 246, 0.3)",
            }}
          >
            {/* 유저 이름의 첫 글자 'G' 출력 */}
            {user.name.charAt(0)}
          </div>

          {/* ✅ 수정: 접혔을 때 텍스트 영역 완전히 숨김 (isOpen 조건부 렌더링으로 교체) */}
          {isOpen && (
            <div className="flex flex-col flex-1 min-w-0">
              {/* ✅ 수정: 글자 크기를 영상에 맞게 약간 키우고 정돈했습니다. */}
              <span className="text-white text-sm font-semibold tracking-wide truncate">
                {user.name}
              </span>
              <span className="text-white/40 text-[11px] mt-0.5 font-medium">
                {/* 🔌 API 연결: 실제 로그인(access_token) 발급 여부를 plan 텍스트 옆에 표시
                    TODO: 디자인팀과 협의해 별도 뱃지/아이콘으로 바꾸는 것도 고려 가능 */}
                {user.plan}
                {!accessToken && " · 연결 중..."}
              </span>
            </div>
          )}

          {/* ✅ 삭제: 우측에 있던 톱니바퀴 아이콘을 제거했습니다. */}
        </button>
      </div>
    </aside>
  );
}
