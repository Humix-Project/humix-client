import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Stepper from "../components/Stepper"; 
import { useHummingStore } from "../store/useHummingStore"; // Zustand 스토어 import

// ── API 명세 기반 응답 타입 정의 ──
type MelodyNote = {
  start_time_seconds: number;
  pitch: number; // MIDI note number
  duration_seconds: number;
};

// 캔버스 렌더링을 위한 상수 (C3~C6, 0s~8s)
const MIN_PITCH = 48; // C3
const MAX_PITCH = 84; // C6
const MAX_TIME = 8;   // 8 seconds

export default function MelodyEditorPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 전역 상태에서 이전 단계에 저장해둔 hummingId를 꺼내옴
  const hummingId = useHummingStore((s) => s.hummingId);

  const [activeTool, setActiveTool] = useState<"edit">("edit");
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  
  // 재생 상태 및 현재 재생 시간 관리
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // API에서 받아온 피치 데이터를 저장할 상태
  const [notes, setNotes] = useState<MelodyNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 드래그(편집) 상태 관리
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // 1. 초기 데이터 로드 (API POST 요청)
  useEffect(() => {
    // 방어 코드: 만약 스토어에 hummingId가 없다면 비정상적 접근이므로 이전 페이지로 이동
    if (!hummingId) {
      console.warn("저장된 허밍 ID가 없습니다. 이전 페이지로 이동합니다.");
      alert("허밍 ID를 찾을 수 없습니다. 녹음을 먼저 진행해 주세요.");
      navigate("/create"); // 실제 프로젝트의 녹음 페이지 경로에 맞게 수정하세요
      return;
    }

    async function fetchMelodyData() {
      setIsLoading(true);
      try {
        // 하드코딩된 ID 대신 템플릿 리터럴로 스토어의 hummingId 전달
        const response = await fetch(`/api/v1/hummings/${hummingId}/vectors`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer YOUR_TOKEN_HERE" // 실제 인증 토큰 구조에 맞게 교체 필요
          },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("API 응답 데이터:", data);
          setNotes(data.notes || []);
        } else {
          console.error("API 호출 실패:", response.status);
        }
      } catch (error) {
        console.error("네트워크 에러:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMelodyData();
  }, [hummingId, navigate]); // 의존성 배열에 hummingId 추가

  // 2. 재생바 애니메이션 루프
  useEffect(() => {
    if (isPlaying) {
      const animate = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        setCurrentTime((prev) => {
          const nextTime = prev + delta;
          if (nextTime >= MAX_TIME) {
            setIsPlaying(false); // 끝에 도달하면 재생 정지
            return MAX_TIME;
          }
          return nextTime;
        });

        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime >= MAX_TIME) {
        setCurrentTime(0);
      }
      lastTimeRef.current = performance.now();
      setIsPlaying(true);
    }
  };

  // 3. Canvas 렌더링 로직 (계단식 스텝 차트 + 영역 채우기 디자인 적용)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // 노트를 시간 순으로 정렬하여 선 연결 보장
    const sortedNotes = [...notes].sort((a, b) => a.start_time_seconds - b.start_time_seconds);

    if (sortedNotes.length > 0) {
      // 1️⃣ 채우기(Fill) 영역 그리기
      ctx.beginPath();
      const firstX = (sortedNotes[0].start_time_seconds / MAX_TIME) * width;
      ctx.moveTo(firstX, height);

      let prevY = height;
      sortedNotes.forEach((note, index) => {
        const x = (note.start_time_seconds / MAX_TIME) * width;
        const y = height - ((note.pitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH)) * height;
        const noteWidth = (note.duration_seconds / MAX_TIME) * width;

        if (index === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, prevY); // 이전 높이 유지 (수평)
          ctx.lineTo(x, y);     // 새로운 높이로 점프 (수직)
        }
        ctx.lineTo(x + noteWidth, y);
        prevY = y;
      });
      
      const lastNote = sortedNotes[sortedNotes.length - 1];
      const lastX = ((lastNote.start_time_seconds + lastNote.duration_seconds) / MAX_TIME) * width;
      ctx.lineTo(lastX, height);
      ctx.closePath();
      
      // 반투명 보라색 채우기
      ctx.fillStyle = "rgba(167, 139, 250, 0.18)"; 
      ctx.fill();

      // 2️⃣ 스텝 라인(Stroke) 그리기
      ctx.beginPath();
      prevY = height;
      sortedNotes.forEach((note, index) => {
        const x = (note.start_time_seconds / MAX_TIME) * width;
        const y = height - ((note.pitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH)) * height;
        const noteWidth = (note.duration_seconds / MAX_TIME) * width;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, prevY);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(x + noteWidth, y);
        prevY = y;
      });
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "miter";
      ctx.stroke();

      // 3️⃣ 드래그 핸들 (선택사항, 편집을 위해 작은 점 표시)
      sortedNotes.forEach((note) => {
        const originalIndex = notes.indexOf(note); // 원본 배열 기준 인덱스 찾기
        const x = (note.start_time_seconds / MAX_TIME) * width;
        const y = height - ((note.pitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH)) * height;
        const isDragging = draggingIndex === originalIndex;

        ctx.beginPath();
        ctx.arc(x, y, isDragging ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? "#ffffff" : "#a78bfa";
        ctx.fill();
      });
    }

    // 4️⃣ 현재 재생 시간(Playhead) 빨간 선 그리기
    if (currentTime > 0) {
      const playheadX = (currentTime / MAX_TIME) * width;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.strokeStyle = "#ef4444"; // 밝은 빨간색
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }, [notes, draggingIndex, currentTime]);

  // 4. Canvas 마우스 이벤트 핸들러
  const getMousePos = (e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== "edit") return;
    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    // 클릭한 위치 근처의 노트 찾기
    const clickedIndex = notes.findIndex((note) => {
      const noteX = (note.start_time_seconds / MAX_TIME) * width;
      const noteY = height - ((note.pitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH)) * height;
      const distance = Math.sqrt(Math.pow(x - noteX, 2) + Math.pow(y - noteY, 2));
      return distance < 20;
    });

    if (clickedIndex !== -1) {
      setDraggingIndex(clickedIndex);
      setCurrentTime(notes[clickedIndex].start_time_seconds);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingIndex === null) return;
    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    if (!width || width <= 0 || !height || height <= 0) return;

    const newTime = Math.max(0, Math.min((x / width) * MAX_TIME, MAX_TIME));
    let newPitch = MIN_PITCH + ((height - y) / height) * (MAX_PITCH - MIN_PITCH);

    if (isSnapEnabled) {
      newPitch = Math.round(newPitch);
    }

    setNotes((prevNotes) => {
      const updated = [...prevNotes];
      updated[draggingIndex] = {
        ...updated[draggingIndex],
        start_time_seconds: Number(newTime.toFixed(2)),
        pitch: newPitch,
      };
      return updated;
    });
    
    setCurrentTime(newTime);
  };

  const handleMouseUp = () => {
    setDraggingIndex(null);
  };

  // 5. 완료 및 저장 버튼 로직 (API PUT 요청 실전 연동)
  const handleSaveAndComplete = async () => {
    if (!hummingId) return;

    setIsSaving(true);
    try {
      // 주소 및 Body 페이로드에 스토어의 hummingId를 동적 매핑
      const response = await fetch(`/api/v1/hummings/${hummingId}/vectors`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer YOUR_TOKEN_HERE" // 실제 토큰 교체 필요
        },
        body: JSON.stringify({
          humming_id: hummingId,
          notes: notes,
        }),
      });

      if (response.ok) {
        navigate("/concept"); // 저장 완료 후 다음 단계인 컨셉 설정 페이지로 이동
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("저장 실패:", response.status, errorData);
        alert(`수정된 멜로디를 저장하는데 실패했습니다. (상태 코드: ${response.status})`);
      }
    } catch (error) {
      console.error("저장 중 네트워크/CORS 에러 발생:", error);
      alert("서버와 통신할 수 없습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("편집 내용을 초기화하시겠습니까?")) {
      window.location.reload(); 
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Stepper 영역 */}
        <div className="w-full bg-[#1A1D24] rounded-lg p-5 border border-gray-800 shadow-sm flex items-center justify-center mb-6">
          <Stepper currentStep={2} />
        </div>

        {/* 상단 타이틀 */}
        <div className="mb-6 flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">멜로디 편집</h1>
            <p className="text-sm text-gray-500">
              피치 커브를 드래그해 음정(위/아래) 및 시간(좌/우)을 수정하세요
            </p>
          </div>
        </div>

        {/* 메인 에디터 영역 */}
        <div className="bg-[#15171C] border border-gray-800 rounded-xl p-5 shadow-xl">
          {/* 툴바 (상단 컨트롤) */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTool("edit")}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTool === "edit"
                      ? "border border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#a78bfa] shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                      : "border border-gray-700/60 bg-transparent text-gray-400 hover:border-[#8B5CF6]/70 hover:text-[#a78bfa] hover:bg-[#8B5CF6]/5"
                  }`}
                >
                  <span>🎯</span> 점 편집
                </button>

                <button
                  onClick={togglePlayback}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isPlaying
                      ? "border border-[#ef4444] bg-[#ef4444]/10 text-[#f87171] shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                      : "border border-gray-700/60 bg-transparent text-gray-400 hover:border-[#8B5CF6]/70 hover:text-[#a78bfa] hover:bg-[#8B5CF6]/5"
                  }`}
                >
                  <span>{isPlaying ? "⏸️" : "▶️"}</span> {isPlaying ? "정지" : "재생"}
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-gray-700/60 bg-transparent text-gray-400 hover:border-[#8B5CF6]/70 hover:text-[#a78bfa] hover:bg-[#8B5CF6]/5"
                >
                  <span className="text-lg leading-none mb-0.5">↺</span> 초기화
                </button>
              </div>

              {/* 음계 스냅 토글 */}
              <div className="flex items-center gap-2 border-l border-gray-800 pl-6 cursor-pointer" onClick={() => setIsSnapEnabled(!isSnapEnabled)}>
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isSnapEnabled ? "bg-[#8B5CF6]" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isSnapEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-300 select-none">음계 스냅</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveAndComplete}
                disabled={isSaving}
                className="px-8 py-3 rounded-xl text-base font-bold bg-[#8B5CF6] text-white hover:bg-[#7c3aed] transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] disabled:opacity-50"
              >
                {isSaving ? "저장 중..." : "완료 →"}
              </button>
            </div>
          </div>

          {/* 캔버스 (에디터) 영역 */}
          <div className="relative w-full h-[500px] bg-[#1a1b23] border border-gray-700 rounded-lg overflow-hidden select-none">
            
            {/* 가이드라인 (C3~C6 Y축) */}
            <div className="absolute inset-0 pointer-events-none">
              {["C6", "C5", "C4", "C3"].map((note, index) => (
                <div 
                  key={note} 
                  className="w-full border-t border-gray-600/40 absolute" 
                  style={{ top: `${(index / 3) * 100}%` }}
                >
                  <span className={`absolute left-3 text-xs font-semibold text-gray-500 ${index === 0 ? 'top-1' : index === 3 ? '-top-5' : '-top-4'}`}>
                    {note}
                  </span>
                </div>
              ))}
            </div>

            {/* 상태 텍스트 (우측 상단) */}
            {!isLoading && notes.length > 0 && (
              <div className="absolute top-4 right-4 text-xs z-20 pointer-events-none flex flex-col items-end gap-1">
                <span className="text-[#a78bfa]">✓ 데이터 로드 완료 (노트 {notes.length}개)</span>
                {currentTime > 0 && (
                  <span className="text-red-400 font-medium bg-black/40 px-2 py-1 rounded">
                    재생: {currentTime.toFixed(2)}s
                  </span>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-20">
                API 데이터를 불러오는 중...
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`w-full h-full relative z-10 ${activeTool === "edit" ? "cursor-crosshair" : "cursor-default"}`}
                style={{ touchAction: "none" }}
              />
            )}

            {/* 시간축 가이드 (하단) */}
            <div className="absolute bottom-0 left-0 w-full h-8 flex items-center justify-between px-4 text-xs text-gray-500 border-t border-gray-700/50 bg-[#15171C]/80 z-20 pointer-events-none">
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
