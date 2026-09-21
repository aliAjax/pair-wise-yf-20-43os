import type { ShowScript } from "./types";

// 内置示例脚本（原稿）。节点时间可在页面上调整，段落可移除/恢复。
export function createSeedScript(): ShowScript {
  return {
    version: 1,
    title: "滨江音乐烟花晚会 · 整场脚本",
    musicDurationMs: 255_000,
    models: [
      { id: "M1", name: "75mm礼花弹", category: "礼花弹", caliber: 75, durationMs: 8_000, safetyRadius: 30 },
      { id: "M2", name: "30mm扇形架", category: "扇形架", caliber: 30, durationMs: 6_000, safetyRadius: 18 },
      { id: "M3", name: "20mm罗马烛光", category: "罗马烛光", caliber: 20, durationMs: 12_000, safetyRadius: 12 },
      { id: "M4", name: "冷焰火喷泉", category: "冷焰火", caliber: 0, durationMs: 9_000, safetyRadius: 8 },
    ],
    points: [
      { id: "P1", name: "A 北岸高地", x: 14, y: 10 },
      { id: "P2", name: "B 湖心台", x: 60, y: 30 },
      { id: "P3", name: "C 南看台前", x: 102, y: 18 },
      { id: "P4", name: "D 近景区", x: 100, y: 32 },
    ],
    segments: [
      { id: "S1", name: "Intro 引子", startMs: 0 },
      { id: "S2", name: "Chorus A 主歌", startMs: 45_000 },
      { id: "S3", name: "Bridge 过门", startMs: 120_000 },
      { id: "S4", name: "Finale 终章", startMs: 180_000 },
    ],
    removedSegments: [],
    musicCues: [
      { id: "K1", label: "起势", timeMs: 0, segmentId: "S1" },
      { id: "K2", label: "主歌重拍", timeMs: 62_000, segmentId: "S2" },
      { id: "K3", label: "主歌尾拍", timeMs: 90_000, segmentId: "S2" },
      { id: "K4", label: "过门垫点", timeMs: 126_000, segmentId: "S3" },
      { id: "K5", label: "终章高潮", timeMs: 200_000, segmentId: "S4" },
      { id: "K6", label: "收束", timeMs: 238_000, segmentId: "S4" },
    ],
    cues: [
      { id: "N1", code: "01", modelId: "M2", pointId: "P1", angle: 90, ignitionMs: 0, segmentId: "S1", musicCueId: "K1", revision: 1 },
      { id: "N2", code: "02", modelId: "M1", pointId: "P2", angle: 180, ignitionMs: 3_000, segmentId: "S1", musicCueId: "K1", revision: 1 },
      { id: "N3", code: "03", modelId: "M3", pointId: "P2", angle: 180, ignitionMs: 68_200, segmentId: "S2", musicCueId: "K2", revision: 1 },
      { id: "N4", code: "04", modelId: "M2", pointId: "P3", angle: 270, ignitionMs: 75_000, segmentId: "S2", musicCueId: "K2", revision: 1 },
      { id: "N5", code: "05", modelId: "M1", pointId: "P3", angle: 270, ignitionMs: 112_000, segmentId: "S2", musicCueId: "K3", revision: 1 },
      { id: "N6", code: "06", modelId: "M1", pointId: "P1", angle: 90, ignitionMs: 200_000, segmentId: "S4", musicCueId: "K5", revision: 1 },
      { id: "N7", code: "07", modelId: "M2", pointId: "P2", angle: 180, ignitionMs: 210_000, segmentId: "S4", musicCueId: "K5", revision: 1 },
      // N8 在 B 点与 N7 时间重叠：首次整场预演将停在此冲突节点
      { id: "N8", code: "08", modelId: "M4", pointId: "P2", angle: 0, ignitionMs: 214_000, segmentId: "S4", musicCueId: "K5", revision: 1 },
      { id: "N9", code: "09", modelId: "M3", pointId: "P3", angle: 270, ignitionMs: 240_000, segmentId: "S4", musicCueId: "K6", revision: 1 },
    ],
  };
}
