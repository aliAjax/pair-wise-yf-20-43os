// 时间 / 距离等纯函数工具

const TIME_RE = /^(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/;

/** "01:08.200" -> 68200；无法解析返回 null */
export function parseTime(text: string): number | null {
  const match = TIME_RE.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds >= 60) return null;
  const fracText = (match[3] ?? "").padEnd(3, "0");
  return minutes * 60_000 + seconds * 1000 + Number(fracText);
}

/** 68200 -> "01:08.200" */
export function formatTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return `${mm}:${ss}.${mmm}`;
}

/** 平面两点距离（米） */
export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function roundMeters(value: number): number {
  return Math.round(value * 10) / 10;
}
