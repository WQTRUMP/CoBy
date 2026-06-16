import type { GraphViewModel } from "../types/viewModels";

interface StatusStripProps {
  graph: GraphViewModel;
}

export function StatusStrip({ graph }: StatusStripProps) {
  return (
    <section className="systemStrip" aria-label="图谱视觉系统与动画说明">
      <div className="systemStripBlock">
        <strong>节点大小（按市值 USD）</strong>
        <div className="marketLegendDots">
          <span>
            <i className="dot xs" />
            &lt; $1B
          </span>
          <span>
            <i className="dot sm" />
            $1B-$10B
          </span>
          <span>
            <i className="dot md" />
            $10B-$50B
          </span>
          <span>
            <i className="dot lg" />
            $50B-$100B
          </span>
          <span>
            <i className="dot xl" />
            $100B+
          </span>
        </div>
      </div>

      <div className="systemStripBlock">
        <strong>关系类型图例</strong>
        <div className="semanticLegend">
          {graph.relationTypeOptions.map((option) => (
            <span key={option.value}>
              <i data-type={option.value} />
              {option.label}
            </span>
          ))}
        </div>
      </div>

      <div className="systemStripBlock">
        <strong>层级深度图例</strong>
        <div className="tierLegend">
          <span><i className="tier tier1" />1级</span>
          <span><i className="tier tier2" />2级</span>
          <span><i className="tier tier3" />3级</span>
          <span><i className="tier tier4" />4级+</span>
        </div>
      </div>

      <div className="systemStripBlock">
        <strong>动效与交互时长</strong>
        <div className="motionChips">
          <span>展开 / 收缩 280ms</span>
          <span>搜索定位 220ms</span>
          <span>侧栏滑入 240ms</span>
          <span>全屏过渡 200ms</span>
        </div>
      </div>
    </section>
  );
}
