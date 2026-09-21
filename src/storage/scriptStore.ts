import { createSeedScript } from "../domain/seed";
import type { ShowScript } from "../domain/types";
import { readJSON, writeJSON } from "./storage";

const SCRIPT_KEY = "script";
const SCRIPT_STORAGE_VERSION = 1;

/** 读取编辑中的原稿；没有存档时返回内置示例脚本 */
export function loadScript(): ShowScript {
  const saved = readJSON<ShowScript>(SCRIPT_KEY);
  if (saved && saved.version === SCRIPT_STORAGE_VERSION && Array.isArray(saved.cues)) {
    return saved;
  }
  return createSeedScript();
}

/** 保存原稿（用户编辑节点、移除段落等） */
export function saveScript(script: ShowScript): void {
  writeJSON(SCRIPT_KEY, script);
}

export function resetScript(): ShowScript {
  const seed = createSeedScript();
  saveScript(seed);
  return seed;
}
