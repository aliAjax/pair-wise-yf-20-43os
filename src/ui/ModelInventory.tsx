import type { ShowScript } from "../domain/types";

/** 型号清单：口径、持续时间、安全半径 */
export function ModelInventory({ script }: { script: ShowScript }) {
  const usedCount = new Map<string, number>();
  for (const cue of script.cues) {
    usedCount.set(cue.modelId, (usedCount.get(cue.modelId) ?? 0) + 1);
  }
  return (
    <table className="model-table">
      <thead>
        <tr>
          <th>型号</th>
          <th>类别</th>
          <th>口径</th>
          <th>持续</th>
          <th>安全半径</th>
          <th>用量</th>
        </tr>
      </thead>
      <tbody>
        {script.models.map((model) => (
          <tr key={model.id}>
            <td>{model.name}</td>
            <td>{model.category}</td>
            <td>{model.caliber === 0 ? "—" : `${model.caliber}mm`}</td>
            <td>{(model.durationMs / 1000).toFixed(0)}s</td>
            <td>{model.safetyRadius}m</td>
            <td>{usedCount.get(model.id) ?? 0} 枚</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
