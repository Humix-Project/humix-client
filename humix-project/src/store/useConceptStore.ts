// src/store/useConceptStore.ts
import { create } from 'zustand';

// 스토어에서 다룰 데이터 타입 정의
interface ConceptState {
  selectedGenre: string | null;
  selectedMoods: string[];
  setConcept: (genre: string | null, moods: string[]) => void;
  resetConcept: () => void; // 나중에 초기화가 필요할 때 쓸 함수
}

export const useConceptStore = create<ConceptState>((set) => ({
  // 초기값 설정 (보내주신 코드의 초기값과 동일하게 세팅)
  selectedGenre: "kpop", 
  selectedMoods: ["bright_exciting"],
  
  // 상태를 업데이트하는 함수
  setConcept: (genre, moods) => set({ selectedGenre: genre, selectedMoods: moods }),
  
  // 상태를 초기화하는 함수
  resetConcept: () => set({ selectedGenre: "kpop", selectedMoods: ["bright_exciting"] }),
}));