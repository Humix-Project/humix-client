import Sidebar from "./components/Sidebar.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.tsx";
import MyProject from "./pages/MyProject.tsx";
import CreateMusic from "./pages/CreateMusic.tsx";
import Faq from "./pages/Faq.tsx";
import MelodyEditorPage from "./pages/MelodyEdit.tsx"; 
//part 3
import ReferenceUpload from "./pages/ReferenceUpload";
// [추가] Step 5 AI 곡 완성 페이지 import
import Generation from "./pages/Generation";
import Concept from "./pages/Concept.tsx";

export default function App() {
  return (
    <BrowserRouter>
      {/* 화면 전체 레이아웃  */}
      <div className="flex h-screen overflow-hidden bg-zinc-900 text-white">
        {/* 1. 항상 고정되는 사이드바 */}
        <Sidebar />

        {/* 2. 주소에 따라 콘텐츠가 바뀌는 메인 영역 */}
        <main className="flex-1 h-full overflow-y-auto  bg-black p-8">
          <Routes>
            {/* 사이드바 navItems의 href 주소와 path를 똑같이*/}
            <Route path="/" element={<Home />} />
            <Route path="/my-project" element={<MyProject />} />
            <Route path="/create-music" element={<CreateMusic />} />

            {/* [추가] 멜로디 편집 페이지 라우트 연결 */}
            <Route path="/MelodyEdit" element={<MelodyEditorPage />} />

            {/* [추가] 컨셉 페이지 라우트 연결 */}
            <Route path="/concept" element={<Concept />} />

            {/* 참고 음악 업로드 — 테스트용 라우트 (나중에 팀원 코드와 합칠 때 정리) */}
            <Route path="/reference-upload" element={<ReferenceUpload />} />

            {/* [추가] Step 5 AI 곡 완성 — 테스트용 라우트 (나중에 팀원 코드와 합칠 때 정리) */}
            <Route path="/generation" element={<Generation />} />

            <Route path="/faq" element={<Faq />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
