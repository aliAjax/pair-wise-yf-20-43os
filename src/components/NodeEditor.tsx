import {
  effectiveRadiusM,
  formatMs,
  requiredGapMs,
  type FireworkNode,
  type LaunchPoint,
} from "../domain/model";

interface NodeEditorProps {
  node: FireworkNode | null;
  points: LaunchPoint[];
  /** 已调整角度/点位的节点，预演只能从它重跑 */
  mustRunFromNodeId: string | null;
  onPatch(nodeId: string, patch: Partial<FireworkNode>): void;
  onRunFrom(nodeId: string): void;
}

/** 节点编辑：仅开放发射角度与燃放点位，改动后只能从该节点重跑 */
export function NodeEditor({ node, points, mustRunFromNodeId, onPatch, onRunFrom }: NodeEditorProps) {
  if (!node) {
    return <p className="empty">在时间轴上选择一个点火节点进行查看与调整。</p>;
  }
  const mustRerun = mustRunFromNodeId === node.id;

  return (
    <div className="node-editor">
      <div className="editor-grid">
        <label>
          <span>节点</span>
          <input value={node.id} readOnly />
        </label>
        <label>
          <span>烟花型号 · 口径</span>
          <input value={`${node.product} · ${node.caliberMm}mm`} readOnly />
        </label>
        <label>
          <span>点火时间</span>
          <input value={formatMs(node.fireAtMs)} readOnly />
        </label>
        <label>
          <span>持续时间</span>
          <input value={`${(node.durationMs / 1000).toFixed(1)}s`} readOnly />
        </label>
        <label>
          <span>发射角度（°，0 为垂直）</span>
          <input
            type="number"
            min={-45}
            max={45}
            step={1}
            value={node.angleDeg}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                onPatch(node.id, { angleDeg: Math.max(-45, Math.min(45, v)) });
              }
            }}
          />
        </label>
        <label>
          <span>燃放点位</span>
          <select value={node.pointId} onChange={(e) => onPatch(node.id, { pointId: e.target.value })}>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>有效安全半径</span>
          <input value={`${effectiveRadiusM(node).toFixed(1)}m`} readOnly />
        </label>
        <label>
          <span>同点位所需间隔</span>
          <input value={formatMs(requiredGapMs(node))} readOnly />
        </label>
      </div>
      <div className="editor-actions">
        <button type="button" className="primary" onClick={() => onRunFrom(node.id)}>
          从该节点重跑
        </button>
        {mustRerun && <span className="hint">该节点已调整角度/点位，预演只能从本节点重跑。</span>}
      </div>
    </div>
  );
}
