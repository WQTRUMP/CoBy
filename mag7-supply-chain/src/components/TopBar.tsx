import { MagnifyingGlass, ScanSmiley, SlidersHorizontal } from "@phosphor-icons/react";
import type { CompanyOptionViewModel, GraphRelationViewModel, GraphViewModel, RelationFilterOptionViewModel } from "../types/viewModels";

interface TopBarProps {
  companies: CompanyOptionViewModel[];
  depth: number;
  filtersOpen: boolean;
  graph: GraphViewModel;
  relationshipSubtype: string | null;
  relationshipTypes: GraphRelationViewModel["relationshipType"][];
  relationshipSubtypeOptions: RelationFilterOptionViewModel[];
  relationTypeOptions: RelationFilterOptionViewModel[];
  onDepthChange: (depth: number) => void;
  onCompanySelect: (companyId: string) => void;
  onFiltersClear: () => void;
  onFiltersToggle: () => void;
  onSearchChange: (value: string) => void;
  onRelationshipSubtypeChange: (value: string | null) => void;
  onRelationshipTypeToggle: (value: GraphRelationViewModel["relationshipType"]) => void;
  search: string;
  selectedCompanyId: string | null;
}

export function TopBar(props: TopBarProps) {
  const {
    companies,
    depth,
    filtersOpen,
    graph,
    onCompanySelect,
    onDepthChange,
    onFiltersClear,
    onFiltersToggle,
    onRelationshipSubtypeChange,
    onRelationshipTypeToggle,
    onSearchChange,
    relationshipSubtype,
    relationshipSubtypeOptions,
    relationshipTypes,
    relationTypeOptions,
    search,
    selectedCompanyId,
  } = props;
  const activeFilterCount = relationshipTypes.length + (relationshipSubtype ? 1 : 0);

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
          <p className="heroCopy subtle">
            Search resolves canonical groups, brands, legal entities, and facility aliases separately so names like Google,
            Alphabet, Google LLC, and Google Cloud are not flattened into one label.
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

            <div className="depthSwitcher" aria-label="Graph depth" role="group">
              {[1, 2, 3].map((value) => (
                <button
                  aria-pressed={value === depth}
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
            <span>{graph.focusCompany.displayName} live focus</span>
            {graph.focusCompany.aliasHitExplanation ? <small>{graph.focusCompany.aliasHitExplanation}</small> : null}
            <button
              aria-expanded={filtersOpen}
              aria-controls="relationship-filters-panel"
              className="headerAction secondary"
              onClick={onFiltersToggle}
              type="button"
            >
              <SlidersHorizontal size={16} />
              {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filters"}
            </button>
          </div>
          {filtersOpen ? (
            <div className="filterPanel" id="relationship-filters-panel">
              <div className="filterPanelSection">
                <div className="filterPanelHeader">
                  <strong>Relationship types</strong>
                  <button className="textButton" onClick={onFiltersClear} type="button">
                    Clear
                  </button>
                </div>
                <div className="filterChipGrid">
                  {relationTypeOptions.map((option) => {
                    const active = relationshipTypes.includes(option.value as GraphRelationViewModel["relationshipType"]);
                    return (
                      <button
                        key={option.value}
                        className={active ? "filterChip active" : "filterChip"}
                        onClick={() => onRelationshipTypeToggle(option.value as GraphRelationViewModel["relationshipType"])}
                        type="button"
                      >
                        <span>{option.label}</span>
                        <strong>{option.count}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="filterPanelSection">
                <div className="filterPanelHeader">
                  <strong>Relationship subtype</strong>
                  <span>{relationshipSubtypeOptions.length} available</span>
                </div>
                <label className="filterSelectField">
                  <span>Subtype</span>
                  <select value={relationshipSubtype ?? ""} onChange={(event) => onRelationshipSubtypeChange(event.target.value || null)}>
                    <option value="">All subtypes</option>
                    {relationshipSubtypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
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
            <strong>{company.displayName}</strong>
            <span>{company.canonicalName && company.canonicalName !== company.displayName ? company.canonicalName : company.ticker}</span>
            <small>{company.aliasHitExplanation ?? company.hierarchySummary}</small>
          </button>
        ))}
      </section>
    </>
  );
}
