import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  companyListQuerySchema,
  searchCompaniesQuerySchema,
  suggestCompaniesQuerySchema,
} from "@mag7/contracts";
import { parseRequest } from "../../lib/request-validation.js";

const CACHE_TTL_SECONDS = 300;

export async function registerCompanyRoutes(app: FastifyInstance) {
  app.get("/api/v1/companies/search", async (request, reply) => {
    const query = parseRequest(searchCompaniesQuerySchema, request.query);
    const cacheKey = [
      "companies",
      "search",
      app.graphRepository.source,
      query.q.toLowerCase(),
      query.limit,
      query.isMag7 ?? "all",
    ].join(":");
    const cached = await app.cacheClient.get(cacheKey);

    if (cached) {
      reply.header("x-cache", "hit");
      return JSON.parse(cached);
    }

    const items = (await app.graphRepository.listCompanies({
      q: query.q,
      isMag7: query.isMag7,
      page: 1,
      pageSize: query.limit,
    })).slice(0, query.limit);
    const payload = {
      items,
      total: items.length,
      query: query.q,
      source: app.graphRepository.source,
    };

    await app.cacheClient.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
    reply.header("x-cache", "miss");
    return payload;
  });

  app.get("/api/v1/companies/suggest", async (request, reply) => {
    const query = parseRequest(suggestCompaniesQuerySchema, request.query);
    const cacheKey = ["companies", "suggest", app.graphRepository.source, query.q.toLowerCase(), query.limit].join(":");
    const cached = await app.cacheClient.get(cacheKey);

    if (cached) {
      reply.header("x-cache", "hit");
      return JSON.parse(cached);
    }

    const items = (await app.graphRepository.listCompanies({
      q: query.q,
      page: 1,
      pageSize: query.limit,
    }))
      .slice(0, query.limit)
      .map((company) => ({
        id: company.id,
        label: company.ticker ? `${company.name} (${company.ticker})` : company.name,
        ticker: company.ticker,
        isMag7: company.isMag7,
      }));
    const payload = {
      items,
      total: items.length,
      query: query.q,
      source: app.graphRepository.source,
    };

    await app.cacheClient.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
    reply.header("x-cache", "miss");
    return payload;
  });

  app.get("/api/v1/companies", async (request, reply) => {
    const query = parseRequest(companyListQuerySchema, request.query);
    const cacheKey = [
      "companies",
      "list",
      app.graphRepository.source,
      query.q?.toLowerCase() ?? "all",
      query.isMag7 ?? "all",
      query.page,
      query.pageSize,
    ].join(":");
    const cached = await app.cacheClient.get(cacheKey);

    if (cached) {
      reply.header("x-cache", "hit");
      return JSON.parse(cached);
    }

    const items = await app.graphRepository.listCompanies(query);
    const start = (query.page - 1) * query.pageSize;
    const pagedItems = items.slice(start, start + query.pageSize);

    const payload = {
      items: pagedItems,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      source: app.graphRepository.source,
    };

    await app.cacheClient.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
    reply.header("x-cache", "miss");
    return payload;
  });

  app.get("/api/v1/companies/:companyId", async (request, reply) => {
    const params = parseRequest(z.object({ companyId: z.string() }), request.params);
    const cacheKey = ["companies", "detail", app.graphRepository.source, params.companyId].join(":");
    const cached = await app.cacheClient.get(cacheKey);

    if (cached) {
      reply.header("x-cache", "hit");
      return JSON.parse(cached);
    }

    const company = await app.graphRepository.getCompany(params.companyId);

    if (!company) {
      reply.code(404);
      return {
        error: "company_not_found",
        companyId: params.companyId,
      };
    }

    const payload = {
      item: company,
      source: app.graphRepository.source,
    };

    await app.cacheClient.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
    reply.header("x-cache", "miss");
    return payload;
  });

  app.get("/api/v1/companies/:companyId/overview", async (request, reply) => {
    const params = parseRequest(z.object({ companyId: z.string() }), request.params);
    const cacheKey = ["companies", "overview", app.graphRepository.source, params.companyId].join(":");
    const cached = await app.cacheClient.get(cacheKey);

    if (cached) {
      reply.header("x-cache", "hit");
      return JSON.parse(cached);
    }

    const overview = await app.graphRepository.getCompanyOverview(params.companyId);

    if (!overview) {
      reply.code(404);
      return {
        error: "company_not_found",
        companyId: params.companyId,
      };
    }

    await app.cacheClient.set(cacheKey, JSON.stringify(overview), CACHE_TTL_SECONDS);
    reply.header("x-cache", "miss");
    return overview;
  });
}
