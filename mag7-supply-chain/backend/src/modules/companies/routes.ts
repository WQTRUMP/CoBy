import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { companyListQuerySchema } from "@mag7/contracts";

export async function registerCompanyRoutes(app: FastifyInstance) {
  app.get("/api/v1/companies", async (request) => {
    const query = companyListQuerySchema.parse(request.query);
    const items = await app.graphRepository.listCompanies(query);
    const start = (query.page - 1) * query.pageSize;
    const pagedItems = items.slice(start, start + query.pageSize);

    return {
      items: pagedItems,
      page: query.page,
      pageSize: query.pageSize,
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
