// 외부 오디오를 Blob URL로 저장해 S3 플레이어로 페이지가 이동하지 않게 합니다.
export async function downloadAudio(url: string, filename: string, signal?: AbortSignal) {
  const response = await fetch(url, { mode: "cors", signal });
  if (!response.ok) throw new Error("파일을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.");
  const blob = await response.blob();
  signal?.throwIfAborted();
  if (!blob.size || (blob.type && !blob.type.startsWith("audio/") && blob.type !== "application/octet-stream")) {
    throw new Error("다운로드할 오디오 파일을 확인할 수 없습니다.");
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // 브라우저가 다운로드를 시작할 시간을 준 뒤 메모리를 해제합니다.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}
