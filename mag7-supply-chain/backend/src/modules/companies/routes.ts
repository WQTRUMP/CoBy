import type { FastifyInstance } from "fastify";
import { z } from "zod";

const companiesQuerySchema = z.object({
  q: z.string().optional(),
});

export async function registerCompanyRoutes(app: FastifyInstance) {
  app.get("/api/v1/companies", async (request) => {
    const query = companiesQuerySchema.parse(request.query);
    const items = await app.graphRepository.listCompanies(query.q);

    return {
      items,
      total: items.length,
      source: app.graphRepository.source,
    };
  });

  app.get("/api/v1/companies/:companyId", async (request, reply) => {
    const params = z.object({ companyId: z.string() }).parse(request.params);
    const company = await app.graphRepository.getCompany(params.companyId);

    if (!company) {
      reply.code(404);
      return {
        error: "company_not_found",
        companyId: params.companyId,
      };
    }

    return {
      item: company,
      source: app.graphRepository.source,
    };
  });

  app.get("/api/v1/companies/:companyId/overview", async (request, reply) => {
    const params = z.object({ companyId: z.string() }).parse(request.params);
    const overview = await app.graphRepository.getCompanyOverview(params.companyId);

    if (!overview) {
      reply.code(404);
      return {
        error: "company_not_found",
        companyId: params.companyId,
      };
    }

    return overview;
  });
}
