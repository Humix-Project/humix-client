import { useState, useEffect, useRef, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import Stepper from "../components/Stepper";
import { useHummingStore } from "../store/useHummingStore";
import { useAuthStore } from "../store/useAuthStore";

type MelodyNote = {
  start_time_seconds: number;
  pitch: number;
  duration_seconds: number;
};

const MIN_PITCH = 48; // C3
const MAX_PITCH = 84; // C6
const MAX_TIME = 8;
const PITCH_COUNT = MAX_PITCH - MIN_PITCH + 1;

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

const NOTE_COLORS = [
  "#5ee4ef", "#5ee4ef",
  "#c69bff", "#c69bff",
  "#f5cc7a",
  "#7ce4b0", "#7ce4b0",
  "#79b9ff", "#79b9ff",
  "#f0a0c6", "#f0a0c6",
  "#c4d391",
];

const midiToFreq = (midi: number) =>
  440 * Math.pow(2, (midi - 69) / 12);

const getNoteName = (pitch: number) => {
  const midi = Math.round(pitch);
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;

  return `${name}${octave}`;
};

const getEditorBounds = (width: number, height: number) => ({
  left: 80,
  top: 34,
  width: Math.max(1, width - 96),
  height: Math.max(1, height - 46),
});

type EditorBounds = ReturnType<typeof getEditorBounds>;

const timeToX = (time: number, bounds: EditorBounds) =>
  bounds.left + (time / MAX_TIME) * bounds.width;

const pitchToY = (pitch: number, bounds: EditorBounds) =>
  bounds.top +
  ((MAX_PITCH - pitch + 0.5) / PITCH_COUNT) * bounds.height;

const getNoteLayout = (
  note: MelodyNote,
  bounds: EditorBounds,
) => {
  const startX = timeToX(note.start_time_seconds, bounds);

  const endX = timeToX(
    Math.min(
      MAX_TIME,
      note.start_time_seconds + note.duration_seconds,
    ),
    bounds,
  );

  const badgeWidth = Math.min(
    bounds.width,
    Math.max(38, endX - startX - 4),
  );

  return {
    x: (startX + endX) / 2,
    y: pitchToY(note.pitch, bounds),
    badgeX: Math.max(
      bounds.left,
      Math.min(
        startX + 2,
        bounds.left + bounds.width - badgeWidth,
      ),
    ),
    badgeWidth,
  };
};

export default function MelodyEditorPage() {
  const navigate = useNavigate();

  const hummingId = useHummingStore((state) => state.hummingId);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [canvasSize, setCanvasSize] = useState({
    width: 0,
    height: 0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeOscillatorsRef = useRef<OscillatorNode[]>([]);

  const [notes, setNotes] = useState<MelodyNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draggingIndex, setDraggingIndex] =
    useState<number | null>(null);

  const draggingPointerRef = useRef<number | null>(null);

  const dragOffsetRef = useRef({
    time: 0,
    pitch: 0,
  });

  // 화면 크기에 맞춰 캔버스 크기 갱신
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  // 멜로디 데이터 불러오기
  useEffect(() => {
    if (!hummingId) {
      alert("허밍 ID를 찾을 수 없습니다. 녹음을 먼저 진행해 주세요.");
      navigate("/create-music");
      return;
    }

    const controller = new AbortController();

    async function fetchMelodyData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/v1/hummings/${hummingId}/vectors`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${
                useAuthStore.getState().accessToken
              }`,
            },
            body: JSON.stringify({}),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setLoadError("멜로디 데이터를 불러오는 데 실패했습니다.");
          return;
        }

        const data = await response.json();
        const loaded: MelodyNote[] = data.result?.notes || [];

        setNotes(loaded);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        console.error("멜로디 로드 실패:", error);
        setLoadError("네트워크 오류가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchMelodyData();

    return () => controller.abort();
  }, [hummingId, navigate]);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;

      audioCtxRef.current = new AudioContextClass();
    }

    const context = audioCtxRef.current;

    if (context.state === "suspended") {
      void context.resume();
    }

    return context;
  };

  const stopAudio = () => {
    activeOscillatorsRef.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // 이미 종료된 노드는 무시
      }

      oscillator.disconnect();
    });

    activeOscillatorsRef.current = [];
  };

  const playAudio = (
    startTime: number,
    currentNotes: MelodyNote[],
  ) => {
    const context = getAudioContext();
    const now = context.currentTime;

    currentNotes.forEach((note) => {
      const noteEnd =
        note.start_time_seconds + note.duration_seconds;

      if (noteEnd <= startTime || note.duration_seconds <= 0) {
        return;
      }

      const offset = Math.max(
        0,
        note.start_time_seconds - startTime,
      );

      const duration = Math.min(
        noteEnd - Math.max(startTime, note.start_time_seconds),
        MAX_TIME - Math.max(startTime, note.start_time_seconds),
      );

      if (duration <= 0) return;

      const playTime = now + offset;
      const attack = Math.min(0.03, duration / 3);
      const release = Math.min(0.05, duration / 3);

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = midiToFreq(note.pitch);

      gain.gain.setValueAtTime(0, playTime);
      gain.gain.linearRampToValueAtTime(
        0.3,
        playTime + attack,
      );
      gain.gain.setValueAtTime(
        0.3,
        playTime + duration - release,
      );
      gain.gain.linearRampToValueAtTime(
        0,
        playTime + duration,
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(playTime);
      oscillator.stop(playTime + duration);

      activeOscillatorsRef.current.push(oscillator);
    });
  };

  // 페이지를 떠날 때 소리 정리
  useEffect(() => {
    return () => {
      activeOscillatorsRef.current.forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch {
          // 이미 종료된 노드는 무시
        }

        oscillator.disconnect();
      });

      activeOscillatorsRef.current = [];

      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  // 재생 위치 갱신
  useEffect(() => {
    if (!isPlaying) {
      stopAudio();
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setCurrentTime((previous) =>
        Math.min(MAX_TIME, previous + delta),
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && currentTime >= MAX_TIME) {
      const frame = requestAnimationFrame(() => {
        setIsPlaying(false);
      });

      return () => cancelAnimationFrame(frame);
    }
  }, [currentTime, isPlaying]);

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio();
      return;
    }

    const startTime = currentTime >= MAX_TIME ? 0 : currentTime;

    setCurrentTime(startTime);
    stopAudio();
    playAudio(startTime, notes);
    setIsPlaying(true);
  };

  // 격자, 곡선, 음이름 배지 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !canvasSize.width || !canvasSize.height) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    const { width, height } = canvasSize;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      0,
    );

    const bounds = getEditorBounds(width, height);
    const rowHeight = bounds.height / PITCH_COUNT;

    const activePitches = new Set(
      notes.map((note) => Math.round(note.pitch)),
    );

    const selectedNote =
      draggingIndex === null ? null : notes[draggingIndex];

    const selectedPitch = selectedNote
      ? Math.round(selectedNote.pitch)
      : null;

    context.fillStyle = "#101216";
    context.fillRect(0, 0, width, height);

    // 반음 단위 배경과 왼쪽 음정 눈금
    for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
      const y =
        bounds.top + (MAX_PITCH - pitch) * rowHeight;

      const isBlackKey = [1, 3, 6, 8, 10].includes(
        pitch % 12,
      );

      const isOctave = pitch % 12 === 0;

      context.fillStyle = isBlackKey
        ? "#101216"
        : "#17191f";

      context.fillRect(
        bounds.left,
        y,
        width - bounds.left,
        rowHeight,
      );

      if (activePitches.has(pitch)) {
        context.fillStyle =
          selectedPitch === pitch ? "#1b4548" : "#123037";

        context.fillRect(
          bounds.left,
          y,
          width - bounds.left,
          rowHeight,
        );
      }

      context.fillStyle = isBlackKey
        ? "#15191e"
        : "#20242a";

      context.fillRect(0, y, bounds.left, rowHeight);

      context.textBaseline = "middle";
      context.textAlign = "left";
      context.font =
        "600 10px ui-sans-serif, system-ui, sans-serif";

      context.fillStyle = isOctave
        ? "#67e8ee"
        : "#c1c8d0";

      context.fillText(
        getNoteName(pitch),
        isOctave ? 22 : 14,
        y + rowHeight / 2,
      );

      if (isOctave) {
        context.beginPath();
        context.arc(
          13,
          y + rowHeight / 2,
          2.5,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.textAlign = "right";
      context.font =
        "9px ui-sans-serif, system-ui, sans-serif";

      context.fillStyle = isOctave
        ? "#4a8b91"
        : "#68727c";

      context.fillText(
        String(Math.round(midiToFreq(pitch))),
        bounds.left - 8,
        y + rowHeight / 2,
      );
    }

    // 상단 시간 눈금
    const rulerGradient = context.createLinearGradient(
      0,
      0,
      0,
      bounds.top,
    );

    rulerGradient.addColorStop(0, "#343b42");
    rulerGradient.addColorStop(1, "#1b2027");

    context.fillStyle = rulerGradient;
    context.fillRect(0, 0, width, bounds.top);

    context.textBaseline = "middle";
    context.textAlign = "left";
    context.font =
      "600 10px ui-sans-serif, system-ui, sans-serif";
    context.fillStyle = "#bdc5cf";
    context.fillText("NOTE / Hz", 12, bounds.top / 2);

    const labelStep =
      [1, 2, 4, 8].find(
        (step) => (bounds.width * step) / MAX_TIME >= 112,
      ) ?? 8;

    for (let time = 0; time <= MAX_TIME; time += 0.5) {
      const x = timeToX(time, bounds);
      const isSecond = Number.isInteger(time);

      context.beginPath();
      context.moveTo(x, bounds.top);
      context.lineTo(x, bounds.top + bounds.height);

      context.strokeStyle = isSecond
        ? "rgba(155, 170, 185, 0.09)"
        : "rgba(155, 170, 185, 0.035)";

      context.lineWidth = 1;
      context.stroke();

      context.beginPath();
      context.moveTo(
        x,
        bounds.top - (isSecond ? 7 : 4),
      );
      context.lineTo(x, bounds.top);
      context.strokeStyle = "#56606b";
      context.stroke();

      if (time % labelStep === 0) {
        context.textAlign =
          time === MAX_TIME ? "right" : "left";

        context.font =
          "10px ui-monospace, SFMono-Regular, monospace";

        context.fillStyle = "#c0c9d2";

        context.fillText(
          `0:${String(time).padStart(2, "0")}.000`,
          x + (time === MAX_TIME ? -4 : 6),
          14,
        );
      }
    }

    context.beginPath();
    context.moveTo(bounds.left, 0);
    context.lineTo(bounds.left, height);
    context.strokeStyle = "#303740";
    context.stroke();

    // 곡선과 노트는 편집 영역 안에서만 표시
    context.save();
    context.beginPath();
    context.rect(
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
    );
    context.clip();

    const sortedNotes = notes
      .map((note, index) => ({
        note,
        index,
        ...getNoteLayout(note, bounds),
      }))
      .sort((a, b) => a.x - b.x);

    if (sortedNotes.length > 0) {
      const first = sortedNotes[0];
      const last = sortedNotes[sortedNotes.length - 1];

      const firstTime = Math.min(
        ...notes.map((note) => note.start_time_seconds),
      );

      const lastTime = Math.min(
        MAX_TIME,
        Math.max(
          ...notes.map(
            (note) =>
              note.start_time_seconds + note.duration_seconds,
          ),
        ),
      );

      const points = [
        {
          x: timeToX(firstTime, bounds),
          y: first.y,
        },
        ...sortedNotes,
        {
          x: timeToX(lastTime, bounds),
          y: last.y,
        },
      ];

      // 직각 계단선 대신 부드러운 베지어 곡선으로 연결
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);

      for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1];
        const point = points[index];
        const middleX = (previous.x + point.x) / 2;

        context.bezierCurveTo(
          middleX,
          previous.y,
          middleX,
          point.y,
          point.x,
          point.y,
        );
      }

      context.strokeStyle = "#65f5cd";
      context.lineWidth = 2.25;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.shadowColor = "rgba(101, 245, 205, 0.4)";
      context.shadowBlur = 10;
      context.stroke();
      context.shadowBlur = 0;

      // 선택 중인 노트는 가장 위에 표시
      const badgeNotes = [...sortedNotes].sort(
        (a, b) =>
          Number(a.index === draggingIndex) -
          Number(b.index === draggingIndex),
      );

      badgeNotes.forEach(
        ({ note, index, x, y, badgeX, badgeWidth }) => {
          const isDragging = draggingIndex === index;

          const color =
            NOTE_COLORS[
              ((Math.round(note.pitch) % 12) + 12) % 12
            ];

          const badgeY = Math.max(bounds.top + 2, y - 24);

          // 음이름 배지
          context.beginPath();
          context.roundRect(
            badgeX,
            badgeY,
            badgeWidth,
            18,
            6,
          );

          context.fillStyle =
            `${color}${isDragging ? "66" : "30"}`;

          context.fill();

          if (isDragging) {
            context.strokeStyle = color;
            context.lineWidth = 1;
            context.stroke();
          }

          context.font =
            "700 10px ui-sans-serif, system-ui, sans-serif";
          context.textAlign = "left";
          context.textBaseline = "middle";
          context.fillStyle = isDragging ? "#ffffff" : color;

          context.fillText(
            getNoteName(note.pitch),
            badgeX + 7,
            badgeY + 9,
          );

          // 배지에 공간이 있으면 미세 음정 차이도 표시
          if (badgeWidth >= 76) {
            const cents = Math.round(
              (note.pitch - Math.round(note.pitch)) * 100,
            );

            context.textAlign = "right";
            context.font =
              "9px ui-monospace, SFMono-Regular, monospace";

            context.fillText(
              `${cents >= 0 ? "+" : ""}${cents}c`,
              badgeX + badgeWidth - 14,
              badgeY + 9,
            );
          }

          // 배지 오른쪽 손잡이
          context.globalAlpha = isDragging ? 1 : 0.7;
          context.beginPath();

          context.roundRect(
            badgeX + badgeWidth - 6,
            badgeY + 4,
            3,
            10,
            1.5,
          );

          context.fill();

          // 곡선 위 드래그 손잡이
          context.beginPath();
          context.roundRect(x - 2.5, y - 5, 5, 10, 2.5);

          context.fillStyle = isDragging
            ? "#ffffff"
            : "#65f5cd";

          context.fill();
          context.globalAlpha = 1;
        },
      );
    }

    context.restore();

    // 재생 위치
    if (currentTime > 0) {
      const playheadX = timeToX(currentTime, bounds);

      context.beginPath();
      context.moveTo(playheadX, bounds.top);
      context.lineTo(
        playheadX,
        bounds.top + bounds.height,
      );

      context.strokeStyle = "#fb7185";
      context.lineWidth = 1.5;
      context.stroke();

      context.beginPath();
      context.moveTo(playheadX - 5, bounds.top - 8);
      context.lineTo(playheadX + 5, bounds.top - 8);
      context.lineTo(playheadX, bounds.top);
      context.closePath();

      context.fillStyle = "#fb7185";
      context.fill();
    }
  }, [notes, draggingIndex, currentTime, canvasSize]);

  const getPointerPosition = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const bounds = getEditorBounds(rect.width, rect.height);

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    return {
      x,
      y,
      bounds,
      time:
        ((x - bounds.left) / bounds.width) * MAX_TIME,
      pitch:
        MAX_PITCH +
        0.5 -
        ((y - bounds.top) / bounds.height) * PITCH_COUNT,
    };
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      draggingPointerRef.current !== null ||
      isLoading ||
      loadError
    ) {
      return;
    }

    const { x, y, bounds, time, pitch } =
      getPointerPosition(event);

    if (
      x < bounds.left ||
      x > bounds.left + bounds.width ||
      y < bounds.top ||
      y > bounds.top + bounds.height
    ) {
      return;
    }

    const hitOrder = notes
      .map((note, index) => ({
        note,
        index,
        ...getNoteLayout(note, bounds),
      }))
      .sort((a, b) => a.x - b.x);

    const hit = hitOrder.reverse().find((layout) => {
      const badgeY = Math.max(
        bounds.top + 2,
        layout.y - 24,
      );

      const onBadge =
        x >= layout.badgeX - 3 &&
        x <= layout.badgeX + layout.badgeWidth + 3 &&
        y >= badgeY - 3 &&
        y <= badgeY + 21;

      const onHandle =
        Math.hypot(x - layout.x, y - layout.y) < 14;

      return onBadge || onHandle;
    });

    if (!hit) return;

    event.preventDefault();

    draggingPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    dragOffsetRef.current = {
      time: time - hit.note.start_time_seconds,
      pitch: pitch - hit.note.pitch,
    };

    setIsPlaying(false);
    stopAudio();
    setDraggingIndex(hit.index);
    setCurrentTime(hit.note.start_time_seconds);
  };

  const handlePointerMove = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (
      draggingIndex === null ||
      event.pointerId !== draggingPointerRef.current
    ) {
      return;
    }

    const { time, pitch } = getPointerPosition(event);
    const note = notes[draggingIndex];

    const newTime = Math.max(
      0,
      Math.min(
        time - dragOffsetRef.current.time,
        Math.max(0, MAX_TIME - note.duration_seconds),
      ),
    );

    const snappedPitch = Math.round(pitch - dragOffsetRef.current.pitch);
    const newPitch = Math.max(
      MIN_PITCH,
      Math.min(MAX_PITCH, snappedPitch),
    );

    setNotes((previous) =>
      previous.map((item, index) =>
        index === draggingIndex
          ? {
              ...item,
              start_time_seconds: Number(
                newTime.toFixed(2),
              ),
              pitch: newPitch,
            }
          : item,
      ),
    );

    setCurrentTime(newTime);
  };

  const handlePointerUp = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (event.pointerId !== draggingPointerRef.current) {
      return;
    }

    if (draggingIndex !== null) {
      const note = notes[draggingIndex];
      const context = getAudioContext();

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = midiToFreq(note.pitch);

      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(
        0.3,
        context.currentTime + 0.02,
      );
      gain.gain.linearRampToValueAtTime(
        0,
        context.currentTime + 0.3,
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);

      activeOscillatorsRef.current.push(oscillator);
    }

    draggingPointerRef.current = null;
    setDraggingIndex(null);

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }
  };

  const handlePointerCancel = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (event.pointerId !== draggingPointerRef.current) {
      return;
    }

    draggingPointerRef.current = null;
    setDraggingIndex(null);
  };

  const handleSaveAndComplete = async () => {
    if (!hummingId || isSaving) return;

    setIsPlaying(false);
    stopAudio();
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/v1/hummings/${hummingId}/vectors`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              useAuthStore.getState().accessToken
            }`,
          },
          body: JSON.stringify({
            humming_id: hummingId,
            notes,
          }),
        },
      );

      if (response.ok) {
        navigate("/concept");
      } else {
        alert(
          `멜로디 저장에 실패했습니다. (상태 코드: ${response.status})`,
        );
      }
    } catch (error) {
      console.error("멜로디 저장 실패:", error);
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
    <div className="min-h-screen bg-[#0B0C10] p-8 font-sans text-gray-200">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex w-full items-center justify-center rounded-lg border border-gray-800 bg-[#1A1D24] p-5">
          <Stepper currentStep={2} />
        </div>

        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-white">
            멜로디 편집
          </h1>

          <p className="text-sm text-gray-500">
            음이름이나 곡선의 핸들을 드래그해 음정(위/아래)과
            시간(좌/우)을 조절하세요
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#15171C] p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-[#8B5CF6] bg-[#8B5CF6]/10 px-5 py-2 text-sm font-medium text-[#a78bfa]"
                >
                  <span>🎯</span>
                  음정 편집
                </button>

                <button
                  type="button"
                  onClick={togglePlayback}
                  disabled={isLoading || notes.length === 0}
                  className={`flex items-center gap-2 rounded-lg border px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isPlaying
                      ? "border-red-400 bg-red-400/10 text-red-400"
                      : "border-gray-700 text-gray-300 hover:border-[#8B5CF6] hover:text-[#a78bfa]"
                  }`}
                >
                  <span>{isPlaying ? "⏸" : "▶"}</span>
                  {isPlaying ? "정지" : "재생"}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-lg border border-gray-700 px-5 py-2 text-sm font-medium text-gray-400 transition-colors hover:border-[#8B5CF6] hover:text-[#a78bfa]"
                >
                  <span className="text-lg">↺</span>
                  초기화
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAndComplete}
              disabled={
                isSaving || isLoading || notes.length === 0
              }
              className="rounded-xl bg-[#8B5CF6] px-8 py-3 text-base font-bold text-white transition-colors hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "완료 →"}
            </button>
          </div>

          <div className="relative h-[620px] w-full overflow-hidden rounded-lg border border-[#303740] bg-[#101216] select-none">
            <canvas
              ref={canvasRef}
              aria-label="멜로디 음정 편집기. 음이름 배지나 곡선 핸들을 드래그해 편집합니다."
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onLostPointerCapture={handlePointerCancel}
              className={`block h-full w-full ${
                draggingIndex === null
                  ? "cursor-crosshair"
                  : "cursor-grabbing"
              }`}
              style={{ touchAction: "none" }}
            >
              Canvas를 지원하는 브라우저가 필요합니다.
            </canvas>

            {isLoading ? (
              <div
                role="status"
                className="absolute inset-0 flex items-center justify-center bg-[#101216]/70 text-sm text-gray-400"
              >
                멜로디를 불러오는 중...
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="absolute inset-0 flex items-center justify-center bg-[#101216]/70 text-sm text-red-400"
              >
                {loadError}
              </div>
            ) : notes.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                표시할 멜로디가 없습니다.
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 rounded-full bg-[#65f5cd]" />
              피치 곡선 · C3–C6
            </span>

            <span className="font-mono tabular-nums">
              {notes.length} notes · {currentTime.toFixed(2)}
              {" / "}
              {MAX_TIME.toFixed(2)} s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
