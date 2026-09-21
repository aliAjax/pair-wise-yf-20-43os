/**
 * 领域模型：燃放脚本（原稿）与预演共享的数据结构。
 * 预演过程只读脚本，绝不回写，保证“原稿不变”。
 */

export interface Segment {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
}

/** 燃放点位，x/y 为平面图坐标（米） */
export interface LaunchPoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** 点火节点：一枚（组）烟花的一次点火 */
export interface FireworkNode {
  id: string;
  segmentId: string;
  pointId: string;
  product: string;
  caliberMm: number;
  /** 发射角度，0 为垂直，负/正为左右倾斜 */
  angleDeg: number;
  fireAtMs: number;
  durationMs: number;
  safetyRadiusM: number;
}

/** 音乐时间点，可挂在某个节目段落上 */
export interface MusicCue {
  id: string;
  label: string;
  atMs: number;
  segmentId: string | null;
}

export interface ShowScript {
  title: string;
  musicDurationMs: number;
  segments: Segment[];
  points: LaunchPoint[];
  nodes: FireworkNode[];
  musicCues: MusicCue[];
}

/** 同点位两枚之间的最小硬间隔 */
export const MIN_TURNAROUND_MS = 500;
/** 安全半径每米折算的间隔毫秒数 */
export const GAP_PER_RADIUS_MS = 20;

/** 同一点位上，前一枚结束到本枚点火所需的安全间隔 */
export function requiredGapMs(node: FireworkNode): number {
  return Math.max(MIN_TURNAROUND_MS, Math.round(node.safetyRadiusM * GAP_PER_RADIUS_MS));
}

/** 倾斜发射会扩大散花范围，有效安全半径随角度增大 */
export function effectiveRadiusM(node: FireworkNode): number {
  const tilt = Math.min(Math.abs(node.angleDeg), 90);
  return Math.round(node.safetyRadiusM * (1 + tilt / 90) * 10) / 10;
}

export function nodeEndMs(node: FireworkNode): number {
  return node.fireAtMs + node.durationMs;
}

export function pointDistance(a: LaunchPoint, b: LaunchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** mm:ss.SSS */
export function formatMs(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(Math.round(ms));
  const minutes = Math.floor(abs / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  const milli = abs % 1000;
  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milli).padStart(3, "0")}`;
}

/** 初始脚本（原稿）。每次调用返回全新对象，便于“恢复原稿”。 */
export function createSeedScript(): ShowScript {
  return {
    title: "江畔之夜焰火",
    musicDurationMs: 222000,
    segments: [
      { id: "seg-intro", name: "Intro", startMs: 0, endMs: 30000 },
      { id: "seg-chorus-a", name: "Chorus A", startMs: 30000, endMs: 90000 },
      { id: "seg-finale", name: "Finale", startMs: 90000, endMs: 222000 },
    ],
    points: [
      { id: "P-A", name: "A 一号点位", x: 18, y: 58 },
      { id: "P-B", name: "B 二号点位", x: 40, y: 30 },
      { id: "P-C", name: "C 三号点位", x: 66, y: 52 },
      { id: "P-D", name: "D 四号点位", x: 92, y: 24 },
    ],
    nodes: [
      { id: "N01", segmentId: "seg-intro", pointId: "P-A", product: "30mm扇形架", caliberMm: 30, angleDeg: 0, fireAtMs: 12500, durationMs: 2500, safetyRadiusM: 25 },
      { id: "N02", segmentId: "seg-intro", pointId: "P-B", product: "30mm扇形架", caliberMm: 30, angleDeg: 0, fireAtMs: 14000, durationMs: 2500, safetyRadiusM: 25 },
      { id: "N03", segmentId: "seg-intro", pointId: "P-C", product: "12mm冷焰火", caliberMm: 12, angleDeg: 0, fireAtMs: 18000, durationMs: 4000, safetyRadiusM: 12 },
      { id: "N04", segmentId: "seg-chorus-a", pointId: "P-A", product: "75mm礼花弹", caliberMm: 75, angleDeg: 0, fireAtMs: 40000, durationMs: 3000, safetyRadiusM: 35 },
      { id: "N05", segmentId: "seg-chorus-a", pointId: "P-B", product: "75mm礼花弹", caliberMm: 75, angleDeg: 0, fireAtMs: 68200, durationMs: 3000, safetyRadiusM: 35 },
      { id: "N06", segmentId: "seg-chorus-a", pointId: "P-D", product: "20mm罗马烛光", caliberMm: 20, angleDeg: 0, fireAtMs: 75000, durationMs: 6000, safetyRadiusM: 18 },
      { id: "N07", segmentId: "seg-finale", pointId: "P-C", product: "75mm礼花弹", caliberMm: 75, angleDeg: 0, fireAtMs: 100000, durationMs: 3000, safetyRadiusM: 35 },
      { id: "N08", segmentId: "seg-finale", pointId: "P-A", product: "30mm扇形架", caliberMm: 30, angleDeg: 0, fireAtMs: 120000, durationMs: 2500, safetyRadiusM: 25 },
      { id: "N09", segmentId: "seg-finale", pointId: "P-B", product: "20mm罗马烛光", caliberMm: 20, angleDeg: 0, fireAtMs: 150000, durationMs: 6000, safetyRadiusM: 18 },
      { id: "N10", segmentId: "seg-finale", pointId: "P-C", product: "12mm冷焰火", caliberMm: 12, angleDeg: 0, fireAtMs: 210000, durationMs: 6000, safetyRadiusM: 12 },
      { id: "N11", segmentId: "seg-finale", pointId: "P-D", product: "12mm冷焰火", caliberMm: 12, angleDeg: 0, fireAtMs: 218000, durationMs: 4000, safetyRadiusM: 12 },
    ],
    musicCues: [
      { id: "M1", label: "前奏起", atMs: 0, segmentId: "seg-intro" },
      { id: "M2", label: "副歌进入", atMs: 30000, segmentId: "seg-chorus-a" },
      { id: "M3", label: "高潮点火", atMs: 100000, segmentId: "seg-finale" },
      { id: "M4", label: "终奏", atMs: 222000, segmentId: "seg-finale" },
    ],
  };
}
