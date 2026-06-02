import { useState } from 'react';
import Stepper from '../components/Stepper';

// 아이콘은 lucide-react 대신 텍스트/이모지를 사용하거나,
// 또는 SVG를 직접 임포트해서 사용하는 방식으로 대체합니다.
// 여기서는 텍스트 이모지로 간단하게 표현했습니다.
const IconMusic = () => <span>🎵</span>;
const IconViolin = () => <span>🎻</span>;
const IconJazz = () => <span>🎷</span>;
const IconClapperboard = () => <span>🎬</span>;

// 데이터 정의
const genres = [
  { id: "kpop", name: "K-POP", icon: IconMusic, description: "밝고 중독적인 멜로디" },
  { id: "classical", name: "Classical", icon: IconViolin, description: "화성학-구조적 완성도" },
  { id: "jazz", name: "Jazz", icon: IconJazz, description: "복잡한 화음-즉흥 연주" },
  { id: "cinematic", name: "Cinematic", icon: IconClapperboard, description: "웅장하고 감성적인 OST" },
];

const moods = [
  { id: "bright_exciting", name: "밝고 신나는", emoji: "☀️" },
  { id: "dark_emotional", name: "어둡고 감성적", emoji: "🌙" },
  { id: "calm_comfortable", name: "차분하고 편안한", emoji: "🍃" },
  { id: "intense_grand", name: "강렬하고 웅장한", emoji: "⚡️" },
  { id: "dreamy_lazy", name: "몽환적이고 나른한", emoji: "🌸" },
  { id: "passionate", name: "열정적인", emoji: "🔥" },
  { id: "melancholy_lonely", name: "쓸쓸하고 고독한", emoji: "❄️" },
  { id: "festival_like", name: "축제 같은", emoji: "🎉" },
];

// 타입 정의
type GenreId = typeof genres[number]['id'];
type MoodId = typeof moods[number]['id'];

export default function Concept() {
  const [selectedGenre, setSelectedGenre] = useState<GenreId | null>("kpop");
  const [selectedMoods, setSelectedMoods] = useState<MoodId[]>(["bright_exciting"]);

  // 분위기 선택/해제 핸들러 (최대 3개 선택)
  const handleMoodToggle = (moodId: MoodId) => {
    setSelectedMoods((prev) => {
      const isSelected = prev.includes(moodId);
      if (isSelected) {
        return prev.filter((id) => id !== moodId);
      } else if (prev.length < 3) {
        return [...prev, moodId];
      }
      return prev; // 3개 이상일 경우 변경하지 않음
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Stepper 적용 (현재 단계: 2. 편집) */}
          <div className="w-full bg-[#1A1D24] rounded-lg p-5 border border-gray-800 shadow-sm flex items-center justify-center">
            <Stepper currentStep={3} />
          </div>
          <br></br>
        
        {/* 상단 타이틀 영역 */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">컨셉 설정</h1>
          <p className="text-sm text-gray-500">
            장르와 분위기를 선택하세요 (장르 1개 필수)
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
                <p className="text-xs text-gray-500 mt-1">장르별 선율 변환 규칙(Yin-Yang 프레임워크)이 적용됩니다.</p>
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
                분위기 선택 <span className="text-gray-400 font-medium ml-1">({selectedMoods.length}/3)</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">V-A(Valence-Arousal) 모델 기반 — BPM·조성·리듬·밀도 자동 조정</p>
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
            <button className="px-6 py-2 rounded-lg text-sm font-bold border border-emerald-700/50 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 transition-colors shadow-lg">
                다음 (멜로디 녹음) →
            </button>
        </div>

      </div>
    </div>
  );
}

