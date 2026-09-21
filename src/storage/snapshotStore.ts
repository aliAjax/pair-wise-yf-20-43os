import type { RehearsalSnapshot, ShowScript } from "../domain/types";
import { readJSON, removeKey, writeJSON } from "./storage";

const SNAPSHOT_KEY = "latest-rehearsal";
const SNAPSHOT_SCHEMA = 1;

/**
 * 读取最近一次预演快照并做结构校验。
 * 快照必须与当前原稿兼容（同一份节点集合、修订号可解释），刷新后才能恢复。
 */
export function loadSnapshot(script: ShowScript): RehearsalSnapshot | null {
  const saved = readJSON<RehearsalSnapshot>(SNAPSHOT_KEY);
  if (!saved || saved.scriptVersion !== script.version || saved.schemaVersion !== SNAPSHOT_SCHEMA) {
    return null;
  }
  if (!Array.isArray(saved.entries) || (saved.state !== "completed" && saved.state !== "stopped")) {
    return null;
  }
  const cueIds = new Set(script.cues.map((c) => c.id));
  if (!saved.entries.every((e) => cueIds.has(e.cueId))) {
    // 节点集合已经对不上（旧版本存档），不可恢复
    return null;
  }
  return saved;
}

/** 成功后写入最近预演快照（包括 stopped；rejected 不调用） */
export function saveSnapshot(snapshot: RehearsalSnapshot): void {
  writeJSON(SNAPSHOT_KEY, snapshot);
}

export function clearSnapshot(): void {
  removeKey(SNAPSHOT_KEY);
}
