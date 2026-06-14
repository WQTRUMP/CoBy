export class DependencyUnavailableError extends Error {
  statusCode = 503;
  error = "dependency_unavailable" as const;

  constructor(
    public readonly dependency: "neo4j" | "redis",
    public readonly detail: string,
    message = `${dependency.toUpperCase()} dependency is unavailable.`,
  ) {
    super(message);
    this.name = "DependencyUnavailableError";
  }
}

export function isDependencyUnavailableError(error: unknown): error is DependencyUnavailableError {
  return error instanceof DependencyUnavailableError;
}

export function toDependencyDetail(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isNeo4jUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const code =
    typeof (error as unknown as { code?: unknown }).code === "string"
      ? String((error as unknown as { code: string }).code).toLowerCase()
      : "";
  const name = error.name.toLowerCase();

  return (
    code.includes("serviceunavailable") ||
    code.includes("sessionexpired") ||
    name.includes("serviceunavailable") ||
    name.includes("sessionexpired") ||
    message.includes("failed to connect") ||
    message.includes("connection refused") ||
    message.includes("neo4j") ||
    message.includes("service unavailable")
  );
}
