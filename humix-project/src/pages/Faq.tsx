// src/pages/FAQ.tsx
import { useState } from "react";

interface FAQItem {
  id: string;
  category: "identity" | "copyright" | "specs";
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  // 1. 서비스 정체성 및 차별점
  {
    id: "faq-1",
    category: "identity",
    question: "기존 AI 작곡 서비스(Suno, Udio 등)와 Humix는 무엇이 다른가요?",
    answer:
      "기존 AI 서비스들은 텍스트 문장으로만 명령할 수 있어 머릿속의 구체적인 멜로디 아이디어를 세밀하게 반영하기 어려웠습니다[cite: 12]. 반면 Humix는 사용자가 녹음한 '허밍 멜로디'를 곡의 중심 뼈대로 고정한 채 편곡을 진행합니다[cite: 15, 91]. 또한, 한 번 생성되면 수정이 불가능한 기존 서비스와 달리, 마우스 드래그로 음정과 박자를 직접 고칠 수 있는 '선 기반의 쌍방향 에디터'를 제공한다는 점이 가장 큰 차별점입니다[cite: 14, 71].",
  },
  {
    id: "faq-2",
    category: "identity",
    question: "악보를 볼 줄 모르거나 노래를 잘 못 불러도 이용할 수 있나요?",
    answer:
      "당연히 가능합니다! Humix는 작곡 경험이 없는 일반인을 주요 대상으로 설계되었습니다[cite: 69, 108]. 마이크에 대고 가볍게 흥얼거리기만 해도, AI가 배경 소음을 차단하고 정교한 음 높이 데이터(MIDI 벡터)로 변환해 줍니다[cite: 18, 560]. 음정이 조금 불안정하거나 박자를 놓쳤더라도, 화면에 그려지는 선(Pitch Curve)을 마우스로 슥슥 움직여 올바른 음으로 쉽게 교정하고 작곡을 시작할 수 있습니다[cite: 14, 81].",
  },
  // 2. 저작권 및 상업적 이용
  {
    id: "faq-3",
    category: "copyright",
    question:
      "Humix로 생성한 음악의 저작권은 누구에게 있나요? 상업적 이용이 가능한가요?",
    answer:
      "Humix를 통해 생성된 곡의 저작권은 원천 아이디어(허밍)를 제공한 사용자 여러분에게 귀속됩니다[cite: 364]. 음악 저작권법상 화성 진행이나 작곡 기법 자체는 보호 대상에서 제외되며, 구체적인 선율(멜로디) 표현이 보호받기 때문입니다[cite: 363]. 본인의 고유한 허밍을 기반으로 생성된 결과물은 고유 저작물로 인정받을 가능성이 매우 높으며, 구독 요금제 조건에 따라 유튜브, 숏폼 등에서 상업적으로 자유롭게 활용하실 수 있습니다[cite: 27, 345].",
  },
  {
    id: "faq-4",
    category: "copyright",
    question:
      "'오디오 스타일 참조(레퍼런스 곡 업로드)' 기능을 쓰면 표절 시비가 생기지 않나요?",
    answer:
      "안심하고 사용하셔도 됩니다. Humix는 참고 음원을 업로드하더라도 기성곡의 멜로디 라인은 철저히 배제하고 추출합니다[cite: 473]. 오직 그 곡이 가진 음색, 공간감, 주파수 대역 등의 '음향적 질감'만 분석하여 사용자의 고유 멜로디에 입혀주는 방식을 취하므로 [cite: 397, 398], 표절 시비를 완벽히 피하면서 원하는 음악적 무드를 안전하게 투영할 수 있습니다[cite: 473].",
  },
  // 3. 기술적 사양 및 기능 안내
  {
    id: "faq-5",
    category: "specs",
    question: "허밍 녹음 시 주의해야 할 점이나 제한 시간이 있나요?",
    answer:
      "시스템의 안정적인 분석을 위해 녹음 길이는 최소 3초에서 최대 60초까지 지원합니다[cite: 104]. 주변 소음이 심할 경우 분석 효율이 떨어질 수 있으므로 가급적 조용한 환경(SNR 10dB 이상 권장)에서 가창해 주시는 것이 좋습니다[cite: 104]. 포맷은 WAV, MP3를 지원하며, 인식 범위는 일반적인 가창 대역인 C2부터 C6까지 정밀하게 추적합니다[cite: 104].",
  },
  {
    id: "faq-6",
    category: "specs",
    question: "음악이 완성되기까지 시간이 얼마나 걸리나요?",
    answer:
      "허밍을 멜로디 벡터로 변환하는 과정은 3초 이내에 완료되며, 최종 AI 곡 완성은 약 10초 ~ 30초 내외가 소요됩니다[cite: 104]. 고부하 연산 처리를 위해 GPU 기반 비동기 작업 큐 시스템을 도입하였으며 [cite: 401], 기다리시는 동안 실시간 진행률(%) 피드백 화면을 통해 작업 상황을 직관적으로 확인하실 수 있습니다[cite: 402, 523].",
  },
  {
    id: "faq-7",
    category: "specs",
    question:
      "곡의 특정 구간만 마음에 들지 않는데, 전체를 다시 생성해야 하나요?",
    answer:
      "아닙니다! Humix의 핵심 차별점 중 하나인 '부분 수정(In-painting)' 기능을 활용해 보세요[cite: 23]. 완성된 곡의 타임라인 파형 위에서 마음에 들지 않는 특정 구간(최소 1마디 이상)을 마우스로 드래그하여 선택한 뒤 [cite: 104], 새로운 프롬프트를 입력하면 전체 틀을 깨지 않고 해당 구간만 정교하게 재생성하여 자연스럽게 합성해 줍니다[cite: 495, 496].",
  },
];

export default function FAQ() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  const filteredFaq = faqData.filter(
    (item) => activeTab === "all" || item.category === activeTab,
  );

  return (
    /* CRITICAL FIX: h-screen과 overflow-y-auto는 유지하되, 
      브라우저 표준 및 WebKit 계열의 스크롤바 가시성을 강제로 hidden 처리하여 2중 스크롤바 현상을 제거 
    */
    <div className="flex-1 h-screen bg-[#121214] text-white p-8 overflow-y-auto select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* ── 헤더 영역 ── */}
      <div className="max-w-3xl mx-auto mb-10">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          자주 묻는 질문 (FAQ)
        </h1>
        <p className="text-sm text-white/40">
          Humix의 워크스페이스 이용 방법, 기술 사양 및 저작권에 대해
          알려드립니다.
        </p>
      </div>

      {/* ── 카테고리 탭 ── */}
      <div className="max-w-3xl mx-auto mb-8 flex gap-2 border-b border-white/5 pb-4">
        {[
          { id: "all", label: "전체" },
          { id: "identity", label: "서비스 차별점" },
          { id: "copyright", label: "저작권 및 상업적 이용" },
          { id: "specs", label: "기술 사양 및 기능" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setOpenId(null); // 탭 전환 시 열려있던 아코디언 초기화
            }}
            className={`
              px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
              ${
                activeTab === tab.id
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 아코디언 리스트 ── */}
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        {filteredFaq.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="border border-white/5 bg-[#1a1a1e] rounded-xl overflow-hidden transition-all duration-200"
            >
              {/* 질문 헤더 토글 버튼 */}
              <button
                onClick={() => toggleAccordion(item.id)}
                className="w-full flex items-center justify-between p-4 text-left group transition-colors"
              >
                <span
                  className={`text-sm font-medium transition-colors duration-200 ${
                    isOpen
                      ? "text-violet-400"
                      : "text-white/80 group-hover:text-violet-400"
                  }`}
                >
                  {item.question}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-4 h-4 text-white/40 transition-transform duration-300 shrink-0 ml-4 ${
                    isOpen ? "transform rotate-180 text-violet-400" : ""
                  }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* 답변 애니메이션 박스 */}
              <div
                className={`
                  transition-all duration-300 ease-in-out overflow-hidden
                  ${isOpen ? "max-h-[500px] border-t border-white/5 opacity-100" : "max-h-0 opacity-0"}
                `}
              >
                <p className="p-4 text-xs leading-relaxed text-white/60 bg-black/10">
                  {item.answer}
                </p>
              </div>
            </div>
          );
        })}

        {filteredFaq.length === 0 && (
          <div className="text-center py-12 text-sm text-white/30">
            해당 카테고리의 질문이 존재하지 않습니다.
          </div>
        )}
      </div>
    </div>
  );
}
