import { useState } from "react";
import Sidebar from "./components/Sidebar.tsx";
import Stepper from "./components/Stepper"; // 상태바 컴포넌트 불러오기
import { BrowserRouter, Routes, Route } from "react-router-dom";

// 임시 컴포넌트 예시
const Home = () => <div className="text-xl font-bold">🏠 홈 화면입니다.</div>;
const MyProject = () => (
  <div className="text-xl font-bold">📂 내 프로젝트 화면입니다.</div>
);

// 음악 만들기 컴포넌트 (각 단계별 페이지로 분리되기 전의 메인 영역)
const CreateMusic = () => {
  // 자동으로 해당 페이지나 상황에 맞는 단계를 지정 (예: 편집 단계인 2로 설정)
  const [step] = useState(2); 

  return (
    <div className="flex flex-col items-center h-full w-full">
      {/* 상단 헤더 영역 영역 - 상태바만 깔끔하게 노출 */}
      <div className="w-full py-4 mb-10 border-b border-zinc-800 flex justify-center">
        <Stepper currentStep={step} />
      </div>

      {/* 실제 콘텐츠가 들어올 영역 */}
      <div className="w-full max-w-5xl px-4 text-left">
        <h2 className="text-xl font-bold mb-4">🎵 음악 만들기 화면입니다.</h2>
        <p className="text-zinc-400 text-sm">
          여기에 pages 폴더에서 작업할 각 단계별(녹음, 편집 등) 상세 UI 컴포넌트가 렌더링됩니다.
        </p>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      {/* 화면 전체 레이아웃  */}
      <div className="flex h-screen overflow-hidden bg-zinc-900 text-white">
        {/* 1. 항상 고정되는 사이드바 */}
        <Sidebar />

        {/* 2. 주소에 따라 콘텐츠가 바뀌는 메인 영역 */}
        <main className="flex-1 h-full overflow-y-auto bg-black p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/my-project" element={<MyProject />} />
            <Route path="/create-music" element={<CreateMusic />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
