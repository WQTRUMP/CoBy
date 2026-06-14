import { MagnifyingGlass, ScanSmiley, SlidersHorizontal } from "@phosphor-icons/react";
import type { CompanyDetail } from "../types/contracts";

interface TopBarProps {
  companies: CompanyDetail[];
  depth: number;
  onDepthChange: (depth: number) => void;
  onCompanySelect: (companyId: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
  selectedCompanyId: string;
}

export function TopBar(props: TopBarProps) {
  const { companies, depth, onCompanySelect, onDepthChange, onSearchChange, search, selectedCompanyId } = props;

  return (
    <header className="topbar">
      <div className="brand">
        <p className="eyebrow">Mag7 Supply Chain Atlas</p>
        <div>
          <h1>证据驱动的图谱探索前端骨架</h1>
          <span>React + TypeScript shell with mock adapters for `/companies`, `/graph/subgraph`, `/relations/:id/evidence`.</span>
        </div>
      </div>

      <div className="searchCluster">
        <label className="searchField">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search companies and suppliers"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search company, supplier, material, evidence..."
          />
        </label>
        <button className="ghostAction" type="button">
          <ScanSmiley size={18} />
          Fullscreen shell
        </button>
      </div>

      <div className="tickerRail" aria-label="Mag7 companies">
        {companies.map((company) => (
          <button
            key={company.id}
            className={company.id === selectedCompanyId ? "ticker active" : "ticker"}
            onClick={() => onCompanySelect(company.id)}
            type="button"
          >
            <strong>{company.ticker}</strong>
            <span>{company.shortName}</span>
          </button>
        ))}
      </div>

      <div className="controlCluster">
        <div className="depthSwitcher" aria-label="Graph depth">
          {[1, 2, 3].map((value) => (
            <button
              key={value}
              className={value === depth ? "depthButton active" : "depthButton"}
              onClick={() => onDepthChange(value)}
              type="button"
            >
              L{value}
            </button>
          ))}
        </div>
        <button className="ghostAction" type="button">
          <SlidersHorizontal size={18} />
          API filters ready
        </button>
      </div>
    </header>
  );
}
