export function resolveFallbackCompanyId(companies, excludedCompanyId) {
    const preferredMag7 = companies.find((company) => company.isMag7 && company.id !== excludedCompanyId);
    if (preferredMag7) {
        return preferredMag7.id;
    }
    return companies.find((company) => company.id !== excludedCompanyId)?.id ?? null;
}
