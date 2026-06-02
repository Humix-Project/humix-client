import React from 'react';

const STEPS = [
  { id: 1, label: '녹음' },
  { id: 2, label: '편집' },
  { id: 3, label: '컨셉' },
  { id: 4, label: '스타일' },
  { id: 5, label: '생성' },
];

interface StepperProps {
  currentStep: number;
}

const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  return (
    // 중앙 정렬 고정
    <div className="flex items-center justify-center w-full bg-transparent">
      {STEPS.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isPending = step.id > currentStep;
        
        const isLast = index === STEPS.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* 원과 텍스트 사이 간격을 gap-2로 살짝 축소 */}
            <div className="flex items-center gap-2">
              {/* 원 크기: w-8(32px) -> w-7(28px)로 축소, 테두리 두께 2 유지 */}
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors duration-200 
                  ${isCompleted ? 'bg-[#8B5CF6] text-white' : ''}
                  ${isActive ? 'border-2 border-[#8B5CF6] text-[#8B5CF6] bg-transparent' : ''}
                  ${isPending ? 'border-2 border-zinc-700 text-zinc-600 bg-transparent' : ''}
                `}
              >
                {isCompleted ? (
                  // 체크마크 크기: w-5 -> w-4로 축소
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  // 원 안의 숫자 크기: text-sm -> text-xs로 축소 (작은 원에 맞춤)
                  <span>{step.id}</span>
                )}
              </div>
              
              {/* 라벨 텍스트: text-base -> text-sm으로 축소 (이게 크기 줄이는 핵심) */}
              <span
                className={`text-sm font-medium transition-colors duration-200
                  ${isActive || isCompleted ? 'text-zinc-200' : 'text-zinc-500'}
                `}
              >
                {step.label}
              </span>
            </div>

            {/* 연결 선: 너비(w-8 sm:w-12)와 양옆 여백(mx-2.5 sm:mx-3)을 살짝 줄임 */}
            {!isLast && (
              <div className="w-8 sm:w-12 h-[1px] mx-2.5 sm:mx-3 bg-zinc-700" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Stepper;