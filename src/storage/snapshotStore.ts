/**
 * 存储：最近预演快照的本地持久化。
 * 每次预演推进（通过或在冲突节点停下）都会落盘，
 * 刷新页面后可恢复时间轴、点位图与冲突清单的展示状态。
 */

import type { ShowScript } from "../domain/model";
import type { RehearsalRun } from "../domain/rehearsal";

const STORAGE_KEY = "hxyfront-62008:rehearsal:latest";

export interface RehearsalSnapshot {
  version: 1;
  savedAt: string;
  /** 拍摄快照时的脚本指纹，用于检测“快照基于旧稿” */
  scriptHash: string;
  run: RehearsalRun;
}

/** djb2 字符串哈希，足够做脚本变更检测，无需引入依赖 */
export function hashScript(script: ShowScript): string {
  const payload = JSON.stringify({
    musicDurationMs: script.musicDurationMs,
    segments: script.segments,
    points: script.points,
    nodes: script.nodes,
    musicCues: script.musicCues,
  });
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function saveSnapshot(run: RehearsalRun, script: ShowScript): RehearsalSnapshot | null {
  try {
    const snapshot: RehearsalSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      scriptHash: hashScript(script),
      run,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export function loadSnapshot(): RehearsalSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RehearsalSnapshot;
    if (parsed.version !== 1 || !parsed.run || !Array.isArray(parsed.run.events)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 隐私模式等场景下静默失败
  }
}
