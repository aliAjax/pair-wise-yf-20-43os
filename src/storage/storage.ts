// 本地持久化：不新增依赖，使用 localStorage；SSR / 隐私模式下静默降级

const PREFIX = "hxyfront-62008:";

export function readJSON<T>(key: string): T | null {
  const fullKey = PREFIX + key;
  try {
    const raw = window.localStorage.getItem(fullKey);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  const fullKey = PREFIX + key;
  try {
    window.localStorage.setItem(fullKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // 忽略
  }
}
