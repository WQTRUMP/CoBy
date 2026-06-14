import { MagnifyingGlass, ScanSmiley, SlidersHorizontal } from "@phosphor-icons/react";
import type { CompanyOptionViewModel, GraphViewModel } from "../types/viewModels";

interface TopBarProps {
  companies: CompanyOptionViewModel[];
  depth: number;
  graph: GraphViewModel;
  onDepthChange: (depth: number) => void;
  onCompanySelect: (companyId: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
  selectedCompanyId: string;
}

export function TopBar(props: TopBarProps) {
  const { companies, depth, graph, onCompanySelect, onDepthChange, onSearchChange, search, selectedCompanyId } = props;

  return (
    <>
      <header className="globalHeader">
        <div className="brandLockup">
          <div className="brandMark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="brandKicker">Mag7</p>
            <strong>Supply Chain Atlas</strong>
          </div>
        </div>

        <nav className="globalNav" aria-label="Primary">
          {["Explore", "Companies", "Suppliers", "Insights", "Watchlist"].map((item, index) => (
            <a className={index === 0 ? "active" : undefined} href="/" key={item} onClick={(event) => event.preventDefault()}>
              {item}
            </a>
          ))}
        </nav>

        <button className="headerAction" type="button">
          <ScanSmiley size={16} />
          My Views
        </button>
      </header>

      <section className="heroGrid">
        <article className="heroPanel">
          <p className="sectionEyebrow">Global Supply Chain Intelligence</p>
          <h1>Trace the hidden infrastructure behind the Magnificent 7</h1>
          <p className="heroCopy">
            Explore supplier, manufacturing, software, logistics, and raw-material dependencies with clear evidence seams and
            graph-first navigation.
          </p>

          <div className="heroControls">
            <label className="searchField">
              <MagnifyingGlass size={18} />
              <input
                aria-label="Search companies and suppliers"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search company, supplier, or material"
              />
            </label>

            <div className="depthSwitcher" aria-label="Graph depth">
              {[1, 2, 3].map((value) => (
                <button
                  key={value}
                  className={value === depth ? "depthButton active" : "depthButton"}
                  onClick={() => onDepthChange(value)}
                  type="button"
                >
                  Tier {value}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="heroCanvasCard">
          <div className="heroCanvasCopy">
            <span>{graph.focusCompany.shortName} live focus</span>
            <button className="headerAction secondary" type="button">
              <SlidersHorizontal size={16} />
              Filters
            </button>
          </div>
          <div className="heroCanvasGlow">
            <div className="heroOrbit heroOrbitPrimary" />
            <div className="heroOrbit heroOrbitSecondary" />
            <div className="heroFocusBadge">{graph.focusCompany.ticker}</div>
          </div>
        </article>
      </section>

      <section className="quickAccessSection" aria-label="Mag7 companies">
        {companies.map((company) => (
          <button
            key={company.id}
            className={company.id === selectedCompanyId ? "ticker active" : "ticker"}
            onClick={() => onCompanySelect(company.id)}
            type="button"
          >
            <strong>{company.shortName}</strong>
            <span>{company.focus}</span>
          </button>
        ))}
      </section>
    </>
  );
}
