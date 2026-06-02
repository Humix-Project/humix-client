import React, { useState } from 'react';
import Stepper from '../components/Stepper'; // 경로에 맞게 확인해주세요

export default function MelodyEditorPage() {
  const [activeTool, setActiveTool] = useState<'edit'>('edit');
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Stepper 적용 (현재 단계: 2. 편집) */}
          <div className="w-full bg-[#1A1D24] rounded-lg p-5 border border-gray-800 shadow-sm flex items-center justify-center">
            <Stepper currentStep={2} />
          </div>
            <br></br>
        
        {/* 상단 타이틀 및 상태바 영역 */}
        <div className="mb-6 flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">멜로디 편집</h1>
            <p className="text-sm text-gray-500">
              피치 커브를 드래그해 음정을 수정하세요
            </p>
          </div>

        </div>

        {/* 메인 에디터 영역 */}
        <div className="bg-[#15171C] border border-gray-800 rounded-xl p-5 shadow-xl">
          
          {/* 툴바 (상단 컨트롤) */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              
              {/* 도구 선택 버튼 그룹 (점 편집, 재생, 초기화) */}
              <div className="flex bg-[#0B0C10] rounded-lg p-1 border border-gray-800">
                <button
                  onClick={() => setActiveTool('edit')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors ${
                    activeTool === 'edit' ? 'bg-[#8B5CF6] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🎯</span> 점 편집
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors ${
                    isPlaying ? 'bg-emerald-600/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <span>{isPlaying ? '⏸️' : '▶️'}</span> {isPlaying ? '정지' : '재생'}
                </button>
                <button
                  onClick={() => console.log('캔버스 초기화')}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors text-gray-400 hover:text-white hover:bg-gray-800/50"
                >
                  <span>↺</span> 초기화
                </button>
              </div>

              {/* 음계 스냅 토글 */}
              <div className="flex items-center gap-2 ml-4">
                <button 
                  onClick={() => setIsSnapEnabled(!isSnapEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isSnapEnabled ? 'bg-[#8B5CF6]' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isSnapEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-sm text-gray-300">음계 스냅</span>
              </div>
            </div>

            {/* 우측 액션 버튼 */}
            <div className="flex items-center gap-3">
              <button className="px-5 py-1.5 rounded-lg text-sm border border-emerald-700/50 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 transition-colors shadow-sm">
                완료 →
              </button>
            </div>
          </div>

          {/* 캔버스 (에디터) 영역 */}
          <div className="relative w-full h-[500px] bg-[#0B0C10] border border-gray-800 rounded-lg overflow-hidden">
            
            {/* 가이드라인 (임시 UI) */}
            <div className="absolute inset-0 flex flex-col justify-between py-8 opacity-20 pointer-events-none">
              {['C5', 'A4', 'F4', 'D4', 'C4'].map((note) => (
                <div key={note} className="w-full border-t border-gray-500 relative">
                  <span className="absolute -top-3 left-4 text-xs text-gray-400">{note}</span>
                </div>
              ))}
            </div>

            {/* 실제 렌더링될 캔버스 엘리먼트 */}
            <canvas 
              id="melody-canvas" 
              className="w-full h-full cursor-crosshair relative z-10"
            ></canvas>

            {/* 시간축 가이드 (하단) */}
            <div className="absolute bottom-0 left-0 w-full h-8 flex items-center justify-between px-4 text-xs text-gray-600 border-t border-gray-800 bg-[#0B0C10]/80">
              <span>0s</span>
              <span>2s</span>
              <span>4s</span>
              <span>6s</span>
              <span>8s</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}