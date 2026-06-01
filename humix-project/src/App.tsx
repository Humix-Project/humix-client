import Sidebar from "./components/Sidebar.tsx";

export default function App() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{/* 메인 콘텐츠 */}</main>
    </div>
  );
}
