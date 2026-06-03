import Sidebar from "./components/Sidebar.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.tsx";
import MyProject from "./pages/MyProject.tsx";
import CreateMusic from "./pages/CreateMusic.tsx";
import Faq from "./pages/Faq.tsx";

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
            <Route path="/faq" element={<Faq />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
