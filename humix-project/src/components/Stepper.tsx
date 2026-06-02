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
    <div className="flex items-center justify-center w-full bg-transparent">
      {STEPS.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isPending = step.id > currentStep;
        
        const isLast = index === STEPS.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-200 
                  ${isCompleted ? 'bg-[#8B5CF6] text-white' : ''}
                  ${isActive ? 'bg-[#8B5CF6] text-white shadow-[0_0_12px_rgba(139,92,246,0.8)] ring-2 ring-offset-2 ring-offset-[#1A1D24] ring-[#8B5CF6]' : ''} /* 🔥 확실하게 불 켜지는 효과! */
                  ${isPending ? 'border-2 border-zinc-700 text-zinc-600 bg-transparent' : ''}
                `}
              >
                {isCompleted ? (
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
                  <span>{step.id}</span>
                )}
              </div>
              
              <span
                className={`text-sm transition-colors duration-200
                  ${isActive ? 'text-white font-bold' : isCompleted ? 'text-zinc-200 font-medium' : 'text-zinc-500 font-medium'} /* 현재 단계 텍스트도 더 밝고 굵게! */
                `}
              >
                {step.label}
              </span>
            </div>

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
