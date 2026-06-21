// src/store/useAuthStore.ts
//
// ─────────────────────────────────────────────
// 로그인(게스트) 상태 관리 스토어 (HuMix_API.pdf 기준)
// ─────────────────────────────────────────────
// [API-1] 게스트 로그인 (최초 진입 시 1회)
// POST /api/v1/auth/guest-login
// Body: { device_id }
// → access_token 반환 (refreshToken은 서버가 HttpOnly 쿠키로 자동 저장)
//
// [API-2] 로그인 연장 (access_token 만료 시 재발급)
// POST /api/v1/auth/silent-refresh
// Headers: Cookie: refreshToken=...  (브라우저가 자동으로 첨부, 별도 처리 불필요)
// → 새 access_token 반환
// ─────────────────────────────────────────────
//
// 사용처: Sidebar.tsx는 여기서 닉네임 등 화면 표시용 값만 꺼내 쓰고,
//         실제 로그인 요청/토큰 보관은 이 스토어가 전담함.
//         Generation.tsx, ReferenceUpload.tsx의 getAccessToken()도
//         이 스토어(useAuthStore.getState().accessToken)로 교체 예정.
//
// ⚠️ 2026-06 수정: 실제 백엔드 응답 구조 실측 결과, PDF 명세서의
//   { code, message, data } 형태가 아니라 { isSuccess, code, message, result }
//   형태로 내려옴 (data가 아니라 result). 아래 ApiEnvelope 및 파싱 로직을
//   실측 구조에 맞게 수정함.
//   실측 예시 (presigned 401 응답):
//   {"isSuccess":false,"code":"AUTH4000","message":"로그인이 필요한 기능입니다.","result":null}

import { create } from "zustand";

// 🔌 API 연결: API 응답 Envelope 공통 타입
// 실제 서버 응답 기준 ({isSuccess, code, message, result}) — PDF 명세서의 {code, message, data}와 다름
interface ApiEnvelope<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}

// 🔌 API 연결: guest-login / silent-refresh 공통 응답 데이터 타입 (API 명세서 3.4.1.1, 3.4.1.2)
interface AuthResponse {
  access_token: string;
}

// device_id를 로컬 스토리지에서 가져오거나, 없으면 새로 만들어 저장하는 유틸
// 비고: 명세서 3.4.1.1 비고란에 "device_id는 클라이언트의 로컬 스토리지에서 생성 및 보관함"이라고 명시되어 있음.
// 기존 Sidebar.tsx의 humix_guest_id 로직(랜덤 4자리 코드)은 "화면에 보여줄 이름"용이었고,
// 이 device_id는 "서버가 기기를 식별하기 위한 값"으로 용도가 다름. crypto.randomUUID()로 표준 UUID를 생성함.
function getOrCreateDeviceId(): string {
  const STORAGE_KEY = "humix_device_id";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  // TODO: crypto.randomUUID()는 HTTPS(또는 localhost) 환경에서만 동작함.
  //       구형 브라우저 지원이 필요하면 uuid 라이브러리(npm install uuid) 사용 검토.
  const newDeviceId = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, newDeviceId);
  return newDeviceId;
}

// 🔌 API 연결: API Base URL
// TODO: 실제 배포 시 .env (VITE_API_BASE_URL 등)로 분리할 것
const API_BASE_URL = "/api/v1";

// 스토어에서 다룰 데이터 타입 정의
interface AuthState {
  accessToken: string | null;
  isLoggingIn: boolean; // guest-login 요청 진행 중 여부 (중복 호출 방지용)
  loginError: string | null;

  // 🔌 API 연결: [API-1] 게스트 로그인 요청. 앱 최초 진입 시 1회 호출 필요 (예: App.tsx 최상단 useEffect).
  loginAsGuest: () => Promise<void>;

  // 🔌 API 연결: [API-2] access_token 갱신 요청. access_token 만료 시 또는 401 응답 받았을 때 호출.
  refreshAccessToken: () => Promise<void>;

  // 로그아웃 시 토큰 초기화 (서버 측 세션 종료 API가 명세서에 없어 우선 클라이언트 상태만 초기화)
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // 초기값 설정
  accessToken: null,
  isLoggingIn: false,
  loginError: null,

  // 게스트 로그인 함수
  loginAsGuest: async () => {
    // 이미 토큰이 있거나 요청이 진행 중이면 중복 호출 방지
    if (get().accessToken || get().isLoggingIn) return;

    set({ isLoggingIn: true, loginError: null });

    try {
      const deviceId = getOrCreateDeviceId();

      const res = await fetch(`${API_BASE_URL}/auth/guest-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 비고: 응답의 refreshToken은 Set-Cookie로 내려오므로, 브라우저가 쿠키를 저장하려면
        //       credentials: 'include' 옵션이 필요함 (프론트-백엔드가 다른 origin일 경우 특히 중요).
        credentials: "include",
        body: JSON.stringify({ device_id: deviceId }),
      });

      if (!res.ok) {
        throw new Error("게스트 로그인 실패");
      }

      const json: ApiEnvelope<AuthResponse> = await res.json();

      // 서버가 isSuccess: false로 200 이외의 비즈니스 에러를 줄 수도 있어 방어적으로 체크
      if (!json.result) {
        throw new Error(json.message || "게스트 로그인 실패");
      }

      set({ accessToken: json.result.access_token, isLoggingIn: false });
    } catch (err) {
      console.error("[게스트 로그인 오류]", err);
      set({ isLoggingIn: false, loginError: "로그인에 실패했습니다." });
    }
  },

  // 토큰 갱신 함수
  refreshAccessToken: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/silent-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 비고: refreshToken은 HttpOnly 쿠키라 JS로 직접 읽거나 헤더에 넣을 수 없음.
        //       credentials: 'include'로 요청하면 브라우저가 쿠키를 자동으로 함께 보내줌.
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        // refreshToken마저 만료된 경우 - 재로그인 필요
        throw new Error("토큰 갱신 실패");
      }

      const json: ApiEnvelope<AuthResponse> = await res.json();

      if (!json.result) {
        throw new Error(json.message || "토큰 갱신 실패");
      }

      set({ accessToken: json.result.access_token });
    } catch (err) {
      console.error("[토큰 갱신 오류]", err);
      // 갱신 실패 시 로그아웃 상태로 전환 - TODO: 재로그인 유도 UI/리다이렉트 처리 필요
      set({ accessToken: null });
    }
  },

  // 상태를 초기화하는 함수
  resetAuth: () =>
    set({ accessToken: null, isLoggingIn: false, loginError: null }),
}));
