import { ArrowsClockwise, CheckCircle, Graph, ShieldCheck } from "@phosphor-icons/react";
import type { SubgraphDTO } from "../types/contracts";

interface StatusStripProps {
  graph: SubgraphDTO;
}

export function StatusStrip({ graph }: StatusStripProps) {
  return (
    <section className="statusStrip">
      <div className="statusCard">
        <Graph size={18} />
        <div>
          <strong>{graph.relations.length}</strong>
          <span>Visible relations in current subgraph</span>
        </div>
      </div>
      <div className="statusCard">
        <ShieldCheck size={18} />
        <div>
          <strong>{Math.round(graph.company.stats.evidenceCoverage * 100)}%</strong>
          <span>Evidence coverage placeholder</span>
        </div>
      </div>
      <div className="statusCard">
        <CheckCircle size={18} />
        <div>
          <strong>{graph.snapshot.version}</strong>
          <span>Snapshot contract flowing through the shell</span>
        </div>
      </div>
      <div className="statusCard">
        <ArrowsClockwise size={18} />
        <div>
          <strong>{graph.company.lastUpdated}</strong>
          <span>Latest mock refresh timestamp</span>
        </div>
      </div>
    </section>
  );
}
