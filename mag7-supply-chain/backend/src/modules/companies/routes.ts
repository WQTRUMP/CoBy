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
}
