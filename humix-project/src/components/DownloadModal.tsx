import { useEffect, useRef, useState } from "react";
import type { SongVersion } from "../utils/generationHistory";
import { downloadAudio } from "../utils/downloadAudio";
import AudioWaveform from "./AudioWaveform";

type IconName = "download" | "close" | "play" | "pause" | "music" | "check";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 16v5h14v-5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="4" /></>,
    music: <><path d="M9 17V5l11-2v12M9 8l11-2" /><ellipse cx="6" cy="17" rx="3" ry="2.5" /><ellipse cx="17" cy="15" rx="3" ry="2.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DownloadModal({ version, onClose }: { version: SongVersion; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const downloadRef = useRef<AbortController | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const filename = `humix_v${version.version_no}.wav`;
  const duration = version.duration_seconds;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const audio = audioRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      downloadRef.current?.abort();
      audio?.pause();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setPlaybackError("");
    try {
      await audio.play();
    } catch {
      setPlaybackError("미리 듣기를 불러오지 못했습니다. 다시 시도해주세요.");
    }
  }

  async function saveFile() {
    if (downloadRef.current) return;
    const controller = new AbortController();
    downloadRef.current = controller;
    setIsDownloading(true);
    setDownloadStarted(false);
    setDownloadError("");
    try {
      await downloadAudio(version.audio_url, filename, controller.signal);
      if (!controller.signal.aborted) setDownloadStarted(true);
    } catch {
      if (!controller.signal.aborted) {
        setDownloadError("파일을 다운로드하지 못했습니다. 다시 시도해주세요. 계속 실패하면 잠시 후 다시 이용해주세요.");
      }
    } finally {
      if (!controller.signal.aborted) {
        downloadRef.current = null;
        setIsDownloading(false);
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="download-title"
      aria-describedby="download-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15171F] p-0 text-gray-200 shadow-[0_24px_100px_#0009] backdrop:bg-black/75"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="download-title" className="text-xl font-bold tracking-tight text-white">곡 다운로드</h2>
            <p id="download-description" className="mt-2 text-xs leading-relaxed text-gray-400">선택한 버전을 확인하고 저장하세요.</p>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="다운로드 팝업 닫기" className="-mr-2 -mt-2 rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-[#532CB6] via-[#9B65E9] to-[#EBA8D6] shadow-lg shadow-violet-950/30">
            <div className="absolute -bottom-10 -left-8 h-24 w-32 -rotate-12 rounded-[50%] bg-[#3C2095]/70 blur-[2px]" />
            <Icon name="music" className="relative h-8 w-8 text-white/90" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">완성된 나의 음악</p>
            <p className="mt-1.5 text-xs text-gray-400">버전 {version.version_no}{version.version_no === 1 ? " (원본)" : ""} <span className="mx-1 text-gray-600">·</span> WAV <span className="mx-1 text-gray-600">·</span> {formatTime(duration)}</p>
            <span className="mt-2 inline-block rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">현재 버전</span>
          </div>
        </div>

        <audio ref={audioRef} src={version.audio_url} preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onError={() => setPlaybackError("오디오를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.")} />
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={togglePlayback} aria-label={isPlaying ? "미리 듣기 일시정지" : "미리 듣기 재생"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-md shadow-violet-950/40 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">
            <Icon name={isPlaying ? "pause" : "play"} className="h-4 w-4" />
          </button>
          <div className="h-10 min-w-0 flex-1 overflow-hidden [&>div]:gap-[2px] [&>div>div]:rounded-full"><AudioWaveform barCount={64} src={version.audio_url} /></div>
        </div>
        <div className="mt-2 pl-[52px]">
          <input type="range" aria-label="미리 듣기 재생 위치" min={0} max={duration || 1} step={0.1} value={Math.min(currentTime, duration)} disabled={Boolean(playbackError)} onChange={(event) => {
            const audio = audioRef.current;
            if (audio && audio.readyState >= 1) {
              audio.currentTime = Number(event.target.value);
              setCurrentTime(audio.currentTime);
            }
          }} className="block h-1 w-full cursor-pointer accent-violet-400 disabled:cursor-default" />
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-gray-500"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
        </div>
        {playbackError && <p role="alert" className="mt-3 text-xs leading-relaxed text-amber-300">{playbackError}</p>}

        <dl className="mt-6 space-y-3 rounded-xl border border-white/[0.06] bg-[#1D202B] px-4 py-4 text-xs">
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-400">파일명</dt><dd className="truncate font-medium text-gray-200">{filename}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-400">형식</dt><dd className="font-medium text-gray-200">WAV</dd></div>
        </dl>
        {downloadError && <p role="alert" className="mt-4 text-xs leading-relaxed text-red-300">{downloadError}</p>}
        <button type="button" onClick={saveFile} disabled={isDownloading} aria-busy={isDownloading} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-[#7C3AED] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 disabled:cursor-wait disabled:opacity-60">
          {isDownloading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden="true" /> : <Icon name={downloadStarted ? "check" : "download"} className="h-4 w-4" />}
          {isDownloading ? "파일 준비 중…" : downloadStarted ? "다시 다운로드" : "WAV 다운로드"}
        </button>
        <p role="status" className="mt-3 min-h-4 text-center text-[11px] text-gray-400">{downloadStarted ? "다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해주세요." : "현재 선택한 버전의 오디오가 저장됩니다."}</p>
        <button type="button" onClick={onClose} className="mx-auto mt-2 block rounded-md px-4 py-2 text-xs text-gray-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">돌아가기</button>
      </div>
    </dialog>
  );
}
