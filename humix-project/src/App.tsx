import Sidebar from "./components/Sidebar.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// 임시 컴포넌트 예시
const Home = () => <div className="text-xl font-bold">🏠 홈 화면입니다.</div>;
const MyProject = () => (
  <div className="text-xl font-bold">📂 내 프로젝트 화면입니다.</div>
);
const CreateMusic = () => (
  //여기부분에서 실제로 만들게 되면 pages라는 폴더에서 각자 맡은 부분하면 된다.
  <div className="text-xl font-bold">🎵 음악 만들기 화면입니다.</div>
);

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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
