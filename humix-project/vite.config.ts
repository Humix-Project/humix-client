import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    open: true,
    //API 연결: 백엔드 서버 프록시 설정 : Vite 개발 서버가 실제 백엔드 주소로 대신 전달
    proxy: {
      "/api": {
        // 백엔드 API 서버 주소 (배포됨)
        target: "https://humix.my-project.cloud",
        changeOrigin: true, // 백엔드 입장에서 origin이 Vite가 아니라 자기 자신인 것처럼 보이도록 처리 (CORS 이슈 방지)
        // secure: false, // TODO: 백엔드가 자체 서명 인증서를 쓰는 경우에만 주석 해제 (정식 인증서면 불필요)
      },
    },
  },
});
