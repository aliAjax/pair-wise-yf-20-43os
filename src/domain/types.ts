// 领域模型：烟花整场预演编排台
// 所有时间统一以毫秒为单位，展示时再格式化为 mm:ss.mmm

export type ModelCategory = "礼花弹" | "罗马烛光" | "扇形架" | "冷焰火";

/** 烟花型号 */
export interface FireworkModel {
  id: string;
  name: string;
  category: ModelCategory;
  /** 口径，毫米 */
  caliber: number;
  /** 燃放持续时间（毫秒） */
  durationMs: number;
  /** 单点位安全距离（半径，米）：同点燃放的间隔与异点间距校验都以此为准 */
  safetyRadius: number;
}

/** 燃放点位（平面图坐标，单位米；场地下方为观众方向） */
export interface LaunchPoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** 节目段落 */
export interface ShowSegment {
  id: string;
  name: string;
  /** 段落起始时间（毫秒） */
  startMs: number;
}

/** 音乐时间点（音乐 cue） */
export interface MusicCue {
  id: string;
  label: string;
  timeMs: number;
  /** 绑定的节目段落 */
  segmentId: string;
}

/** 点火节点（一枚烟花的一次燃放） */
export interface IgnitionCue {
  id: string;
  code: string;
  modelId: string;
  pointId: string;
  /** 发射角度 0-359，0/360 为正北（观众方向），顺时针 */
  angle: number;
  ignitionMs: number;
  segmentId: string;
  musicCueId: string;
  /** 原稿修订号：角度或点位等关键调整后 +1，用于判断“只能从该节点重跑” */
  revision: number;
}

/** 整场脚本（原稿） */
export interface ShowScript {
  version: number;
  title: string;
  /** 音乐总时长（毫秒），音乐时间点越界判定基准 */
  musicDurationMs: number;
  models: FireworkModel[];
  points: LaunchPoint[];
  /** 当前生效的节目段落；被移除的段落移到 removedSegments 以便恢复 */
  segments: ShowSegment[];
  removedSegments: ShowSegment[];
  musicCues: MusicCue[];
  cues: IgnitionCue[];
}

/** 预演节点状态 */
export type RehearsalStatus = "played" | "conflict" | "pending";

/** 冲突类型 */
export type ConflictKind = "overlap" | "spacing";

export interface RehearsalConflict {
  kind: ConflictKind;
  cueId: string;
  otherCueId: string;
  /** 冲突点位（间距冲突时为另一枚所在点位） */
  pointId: string;
  message: string;
}

export interface RehearsalEntry {
  cueId: string;
  pointId: string;
  startMs: number;
  endMs: number;
  status: RehearsalStatus;
  conflict?: RehearsalConflict;
  /** 该节点重跑时对应的原稿修订号 */
  revision: number;
}

export type RehearsalResultState = "completed" | "stopped" | "rejected";

/** 预演拒绝原因（音乐时间点越界 / 段落已移除等整次拒绝） */
export type RejectionKind =
  | "music-out-of-range"
  | "segment-missing"
  | "start-mismatch";

export interface RehearsalRejection {
  kind: RejectionKind;
  message: string;
  cueId?: string;
  segmentId?: string;
}

/** 可刷新恢复的最近一次预演快照 */
export interface RehearsalSnapshot {
  schemaVersion: number;
  scriptVersion: number;
  state: RehearsalResultState;
  ranAt: number;
  /** 本次预演开始节点（null 表示从头整场预演） */
  startCueId: string | null;
  /** 已发生关键调整、必须作为重跑起点的节点 */
  forcedStartCueId: string | null;
  rejection?: RehearsalRejection;
  entries: RehearsalEntry[];
  conflicts: RehearsalConflict[];
  /** 停止在的冲突节点 */
  stopCueId: string | null;
  /** 最后一枚结束时间（时间轴标尺用） */
  endMs: number;
}
