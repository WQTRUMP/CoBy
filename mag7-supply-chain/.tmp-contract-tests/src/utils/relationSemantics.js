const RELATION_TYPE_LABELS = {
    component_supply: "Component Supply",
    manufacturing: "Manufacturing",
    cloud_service: "Cloud / Compute Service",
    raw_material_supply: "Raw Material Supply",
    equipment_supply: "Equipment Supply",
    software_dependency: "Software Dependency",
    logistics: "Logistics Service",
    professional_service: "Professional Service",
    channel_partner: "Channel Partner",
};
const RELATION_SEMANTIC_LABELS = {
    component_supply: "Physical component supply",
    manufacturing: "Manufacturing or foundry capacity",
    cloud_service: "Cloud or compute service",
    raw_material_supply: "Raw-material supply",
    equipment_supply: "Production equipment supply",
    software_dependency: "Software or platform dependency",
    logistics: "Logistics and fulfillment service",
    professional_service: "Professional or advisory service",
    channel_partner: "Distribution or channel partnership",
};
export function getRelationshipTypeLabel(type) {
    return RELATION_TYPE_LABELS[type] ?? humanizeToken(type);
}
export function getRelationshipSemanticLabel(type) {
    return RELATION_SEMANTIC_LABELS[type] ?? humanizeToken(type);
}
export function formatRelationshipSubtype(value) {
    if (!value) {
        return null;
    }
    return humanizeToken(value);
}
export function formatSourceMethod(value) {
    if (!value) {
        return null;
    }
    return humanizeToken(value);
}
export function formatDateResolution(value) {
    if (!value) {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "day")
        return "Day-level";
    if (normalized === "month")
        return "Month-level";
    if (normalized === "quarter")
        return "Quarter-level";
    if (normalized === "year")
        return "Year-level";
    return humanizeToken(value);
}
export function formatValidityLabel(validFrom, validTo) {
    if (validFrom && validTo) {
        return `${validFrom} to ${validTo}`;
    }
    if (validFrom) {
        return `${validFrom} onward`;
    }
    if (validTo) {
        return `Through ${validTo}`;
    }
    return "Validity window unavailable";
}
function humanizeToken(value) {
    return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");
}
