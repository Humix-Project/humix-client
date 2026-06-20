import { create } from "zustand";

// API 3.4.1.6 / 3.4.1.7 응답의 notes 배열 항목
export type MelodyNote = {
  start_time_seconds: number;
  pitch: number;
  duration_seconds: number;
};

type HummingState = {
  // 3.4.1.4 응답값
  hummingId: number | null;
  fileUrl: string | null;
  durationSeconds: number | null;

  // 3.4.1.6 / 3.4.1.7 응답값 (멜로디 벡터)
  melodyVectors: MelodyNote[] | null;

  setHumming: (payload: {
    hummingId: number;
    fileUrl: string;
    durationSeconds: number;
  }) => void;
  setMelodyVectors: (notes: MelodyNote[]) => void;
  reset: () => void;
};

export const useHummingStore = create<HummingState>((set) => ({
  hummingId: null,
  fileUrl: null,
  durationSeconds: null,
  melodyVectors: null,

  setHumming: ({ hummingId, fileUrl, durationSeconds }) =>
    set({ hummingId, fileUrl, durationSeconds }),

  setMelodyVectors: (notes) => set({ melodyVectors: notes }),

  reset: () =>
    set({
      hummingId: null,
      fileUrl: null,
      durationSeconds: null,
      melodyVectors: null,
    }),
}));
