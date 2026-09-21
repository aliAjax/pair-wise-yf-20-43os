import "./styles.css";
import { ConflictList } from "./ui/ConflictList";
import { CueEditor } from "./ui/CueEditor";
import { ModelInventory } from "./ui/ModelInventory";
import { PointMapView } from "./ui/PointMapView";
import { RehearsalBar } from "./ui/RehearsalBar";
import { SegmentPanel } from "./ui/SegmentPanel";
import { TimelineView } from "./ui/TimelineView";
import { useStudio } from "./state/useStudio";

function App() {
  const {
    script,
    snapshot,
    rejection,
    dirtyCue,
    run,
    changeAngle,
    changePoint,
    changeIgnition,
    toggleSegment,
    setMusicDuration,
    restoreSeed,
  } = useStudio();

  const playedCount = snapshot?.entries.filter((e) => e.status === "played").length ?? 0;
  const conflictCount = snapshot?.conflicts.length ?? 0;
  const pendingCount =
    script.cues.length -
    (snapshot?.entries.filter((e) => e.status === "played" || e.status === "conflict").length ??
      0);

  return (
    <main className="app studio">
      <header className="hero hero-compact">
        <p>hxyfront-62008 · 源提示词10 · Port 62008</p>
        <h1>{script.title}</h1>
        <span>
          整场预演按点火时间推进；同一燃放点位前一枚未结束或安全间距不足时立即停在冲突节点。
          调整角度或换点后只能从该节点重跑；音乐时间点越界或段落已移除时整次预演拒绝。
        </span>
      </header>

      <section className="metrics">
        <article>
          <small>节目段落</small>
          <strong>{script.segments.length}</strong>
        </article>
        <article>
          <small>点火节点</small>
          <strong>{script.cues.length}</strong>
        </article>
        <article>
          <small>已燃放 / 未推进</small>
          <strong>
            {playedCount} / {Math.max(0, pendingCount)}
          </strong>
        </article>
        <article>
          <small>冲突提示</small>
          <strong className={conflictCount > 0 ? "metric-danger" : ""}>{conflictCount}</strong>
        </article>
      </section>

      <section className="panel">
        <RehearsalBar
          script={script}
          snapshot={snapshot}
          rejection={rejection}
          dirtyCue={dirtyCue}
          onRun={run}
          onResetDemo={restoreSeed}
        />
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>时间轴编排</p>
            <h2>按点位泳道 · 取自最近预演快照</h2>
          </div>
          <Legend />
        </div>
        <div className="timeline-scroll">
          <TimelineView script={script} snapshot={snapshot} />
        </div>
      </section>

      <section className="map-grid">
        <div className="panel">
          <div className="heading">
            <div>
              <p>燃放点位平面图</p>
              <h2>安全距离圆 · 发射方向 · 冲突连线</h2>
            </div>
          </div>
          <PointMapView script={script} snapshot={snapshot} />
        </div>

        <div className="panel">
          <div className="heading">
            <div>
              <p>冲突时间提示</p>
              <h2>冲突清单</h2>
            </div>
          </div>
          <ConflictList script={script} snapshot={snapshot} />
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>原稿编辑</p>
            <h2>点火节点（调角度 / 换点 / 改点火时间后需重跑）</h2>
          </div>
          {dirtyCue && (
            <span className="dirty-banner">
              节点 #{dirtyCue.code} 已调整，重跑将从该节点开始；其之前的结果沿用上一次快照。
            </span>
          )}
        </div>
        <CueEditor
          script={script}
          snapshot={snapshot}
          dirtyCueId={dirtyCue?.id ?? null}
          onChangeAngle={changeAngle}
          onChangePoint={changePoint}
          onChangeIgnition={changeIgnition}
        />
      </section>

      <section className="lower-grid">
        <div className="panel">
          <div className="heading">
            <div>
              <p>音乐与段落</p>
              <h2>时间点 / 段落移除</h2>
            </div>
          </div>
          <SegmentPanel
            script={script}
            onToggleSegment={toggleSegment}
            onMusicDuration={setMusicDuration}
          />
        </div>

        <div className="panel">
          <div className="heading">
            <div>
              <p>型号清单</p>
              <h2>口径 · 持续 · 安全距离</h2>
            </div>
          </div>
          <ModelInventory script={script} />
        </div>
      </section>
    </main>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="swatch played" /> 已燃放
      </span>
      <span>
        <i className="swatch conflict" /> 冲突停止
      </span>
      <span>
        <i className="swatch pending" /> 未推进
      </span>
      <span>
        <i className="swatch dirty" /> 已调整待重跑
      </span>
    </div>
  );
}

export default App;
