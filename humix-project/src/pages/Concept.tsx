import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper';
import { useConceptStore } from '../store/useConceptStore';

// 아이콘은 lucide-react 대신 텍스트/이모지를 사용하거나,
// 또는 SVG를 직접 임포트해서 사용하는 방식으로 대체합니다.
const IconMusic = () => <span>🎵</span>;
const IconViolin = () => <span>🎻</span>;
const IconJazz = () => <span>🎷</span>;
const IconClapperboard = () => <span>🎬</span>;

const genres = [
  { id: "kpop", name: "K-POP", icon: IconMusic, description: "밝고 중독적인 멜로디" },
  { id: "classical", name: "Classical", icon: IconViolin, description: "화성학-구조적 완성도" },
  { id: "jazz", name: "Jazz", icon: IconJazz, description: "복잡한 화음-즉흥 연주" }, 
  { id: "cinematic", name: "Cinematic", icon: IconClapperboard, description: "웅장하고 감성적인 OST" },
];


const moods = [
  { id: "intense", name: "강렬한", emoji: "⚡️" },
  { id: "dynamic", name: "역동적인", emoji: "🏃" },
  { id: "anxious", name: "불안한", emoji: "😰" },
  { id: "epic", name: "웅장한", emoji: "🏰" },
  { id: "tense", name: "긴장된", emoji: "😬" },
  { id: "grand", name: "장엄한", emoji: "⛰️" },
  { id: "dark", name: "어두운", emoji: "🌙" },
  { id: "sentimental", name: "감성적인", emoji: "💌" },
  { id: "sad", name: "슬픈", emoji: "💧" },
  { id: "melancholic", name: "쓸쓸한", emoji: "🍂" },
  //오타 수정 
  { id: "nostalgic", name: "그리운", emoji: "🕰️" },
  { id: "dreamy", name: "몽환적인", emoji: "🌸" },
  { id: "exciting", name: "신나는", emoji: "😆" },
  { id: "energetic", name: "활기찬", emoji: "🔥" },
  { id: "cheerful", name: "경쾌한", emoji: "🎶" },
  { id: "bright", name: "밝은", emoji: "☀️" },
  { id: "warm", name: "따뜻한", emoji: "☕" },
  { id: "peaceful", name: "평화로운", emoji: "🕊️" },
  { id: "cozy", name: "포근한", emoji: "🧸" },
  { id: "calm", name: "잔잔한", emoji: "🍃" },
];

// 타입 정의
type GenreId = typeof genres[number]['id'];
type MoodId = typeof moods[number]['id'];

export default function Concept() {
  const navigate = useNavigate();
  
  //스토어에 정의된 정확한 변수명(selectedGenre, selectedMoods)으로 꺼내옵니다.
  const savedGenre = useConceptStore((state) => state.selectedGenre);
  const savedMoods = useConceptStore((state) => state.selectedMoods);
  const setConcept = useConceptStore((state) => state.setConcept);

  // useState의 초기값을 스토어 값으로 설정합니다. 
  const [selectedGenre, setSelectedGenre] = useState<GenreId | null>(
    (savedGenre as GenreId) || "kpop"
  );
  
  // 초기 선택값을 명세서에 존재하는 단일 Enum 값인 "bright"로 안전하게 설정했습니다.
  const [selectedMoods, setSelectedMoods] = useState<MoodId[]>(
    savedMoods && savedMoods.length > 0 ? (savedMoods as MoodId[]) : ["bright"]
  );

  // 분위기 선택 핸들러 (무조건 1개만 선택되도록 배열을 덮어씌움)
  const handleMoodToggle = (moodId: MoodId) => {
    setSelectedMoods([moodId]);
  };

  // 다음 페이지로 넘어가는 핸들러 함수
  const handleNextStep = () => {
    // Zustand 전역 상태(Store)에 현재 선택한 장르와 분위기를 저장
    setConcept(selectedGenre, selectedMoods);
    
    // 다음 단계인 참고 음악 선택 페이지(Reference.tsx)의 라우터 경로로 이동
    navigate('/reference'); 
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Stepper 적용 (현재 단계: 3. 컨셉) */}
        <div className="w-full bg-[#1A1D24] rounded-lg p-5 border border-gray-800 shadow-sm flex items-center justify-center">
          <Stepper currentStep={3} />
        </div>
        <br></br>
        
        {/* 상단 타이틀 영역 */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">컨셉 설정</h1>
          <p className="text-sm text-gray-500">
            장르와 분위기를 선택하세요
          </p>
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div className="bg-[#15171C] border border-gray-800 rounded-xl p-5 md:p-8 shadow-xl flex flex-col gap-12">
          
          {/* 장르 선택 섹션 */}
          <div>
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-white">
                장르 선택 <span className="text-purple-400 font-bold ml-1">▪︎ 필수 (1개)</span>
                </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {genres.map((genre) => {
                const Icon = genre.icon;
                const isSelected = selectedGenre === genre.id;
                return (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedGenre(genre.id)}
                    className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200 aspect-square
                      ${ isSelected 
                        ? "bg-purple-500/20 border-purple-500 ring-2 ring-purple-500" 
                        : "bg-zinc-800/50 border-transparent hover:border-purple-500"
                      }`
                    }
                  >
                    <div className={`mb-3 ${isSelected ? 'text-purple-400' : 'text-zinc-400'}`}>
                        <Icon />
                    </div>
                    <span className="font-bold text-base text-white mb-1">{genre.name}</span>
                    <span className="text-xs text-gray-400 text-center">{genre.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 분위기 선택 섹션 */}
          <div>
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-white">
                분위기 선택 <span className="text-purple-400 font-bold ml-1">▪︎ 필수 (1개)</span>
                </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {moods.map((mood) => {
                const isSelected = selectedMoods.includes(mood.id);
                return (
                  <button
                    key={mood.id}
                    onClick={() => handleMoodToggle(mood.id)}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors duration-200 flex items-center gap-2
                    ${ isSelected 
                        ? "bg-purple-500/20 border-purple-500 text-purple-300"
                        : "bg-zinc-800 border-transparent hover:border-purple-500"
                    }`
                   }
                  >
                    <span>{mood.emoji}</span>
                    <span>{mood.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* 하단 네비게이션 버튼 */}
        <div className="mt-8 flex justify-end">
            <button 
              onClick={handleNextStep}
              className="px-8 py-3 rounded-xl text-base font-bold bg-[#8B5CF6] text-white hover:bg-[#7c3aed] transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]"
            >
              다음 (참고 음악 선택) →
            </button>
        </div>

      </div>
    </div>
  );
}
