import { ArrowsClockwise, Buildings, Graph, GlobeHemisphereWest } from "@phosphor-icons/react";
import type { GraphViewModel } from "../types/viewModels";

interface StatusStripProps {
  graph: GraphViewModel;
}

export function StatusStrip({ graph }: StatusStripProps) {
  return (
    <section className="statusStrip" aria-label="Key platform metrics">
      <div className="statusCard light">
        <Buildings size={18} />
        <div>
          <strong>7</strong>
          <span>Mag7 companies</span>
        </div>
      </div>
      <div className="statusCard light">
        <Graph size={18} />
        <div>
          <strong>{graph.company.stats.supplierCount}</strong>
          <span>Suppliers mapped</span>
        </div>
      </div>
      <div className="statusCard light">
        <ArrowsClockwise size={18} />
        <div>
          <strong>{graph.relations.length}</strong>
          <span>Visible relations</span>
        </div>
      </div>
      <div className="statusCard light">
        <GlobeHemisphereWest size={18} />
        <div>
          <strong>{graph.company.primaryRegion}</strong>
          <span>Current focus region</span>
        </div>
      </div>
    </section>
  );
}
