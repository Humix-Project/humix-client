export interface SongVersion {
  generation_id: number;
  version_no: number;
  audio_url: string;
  duration_seconds: number;
  prompt: string | null;
  start_time_sec: number | null;
  end_time_sec: number | null;
}

export interface VersionHistory {
  root_generation_id: number;
  versions: SongVersion[];
}

export async function generationRequest<T>(
  path: string, token: string, options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/v1/generation/songs${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const json = await response.json();
  if (!response.ok || json.isSuccess === false) {
    if (response.status === 409) throw new Error('같은 곡의 생성 작업이 진행 중입니다. 완료되거나 취소된 뒤 다시 시도해주세요.');
    if (response.status === 404) throw new Error('곡이 삭제되었거나 접근할 수 없습니다. 히스토리를 다시 불러와주세요.');
    throw new Error(json.message || '요청에 실패했습니다. 다시 시도해주세요.');
  }
  return json.result as T;
}

export function validateModification(start: number, end: number, duration: number, prompt: string) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end - start < 5 || end > duration) {
    return '수정 구간은 곡 길이 내에서 정수 초로 지정하고, 최소 5초 이상 선택해주세요.';
  }
  if (prompt.length > 500) return '수정 요청은 최대 500자까지 입력할 수 있습니다.';
  return null;
}

export function revertMessage(versions: SongVersion[], targetId: number) {
  const index = versions.findIndex((v) => v.generation_id === targetId);
  if (index < 0 || index === versions.length - 1) return null;
  const deleted = versions.slice(index + 1).map((v) => v.version_no).join(', ');
  return `버전 ${deleted}가 사라집니다. 계속하시겠어요?`;
}
