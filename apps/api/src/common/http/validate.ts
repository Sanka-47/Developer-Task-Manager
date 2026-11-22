import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export interface ValidatedInputs {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parses and sanitises request input. Parsed values replace the raw input in
 * `req.validated`, so controllers never work with unvalidated data.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      const validated: ValidatedInputs = {};

      if (schemas.params) {
        validated.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        validated.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        validated.body = schemas.body.parse(req.body);
      }

      req.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
}
