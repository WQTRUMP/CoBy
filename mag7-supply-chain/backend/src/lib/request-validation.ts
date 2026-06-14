import { z } from "zod";

export interface RequestValidationIssue {
  path?: Array<string | number>;
  code?: string;
  message?: string;
}

export interface RequestValidationError extends Error {
  statusCode: 400;
  issues: RequestValidationIssue[];
}

export function toRequestValidationError(error: z.ZodError): RequestValidationError {
  const validationError = new Error("Invalid request parameters.") as RequestValidationError;
  validationError.statusCode = 400;
  validationError.issues = error.issues;
  return validationError;
}

export function parseRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw toRequestValidationError(result.error);
}
