import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 100;

/**
 * Assigns a correlation id to every request so clients and logs can be
 * matched. Incoming ids are respected (useful behind a gateway) but bounded.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER)?.trim();
  req.requestId =
    incoming && incoming.length <= MAX_REQUEST_ID_LENGTH
      ? incoming
      : randomUUID();

  res.setHeader(REQUEST_ID_HEADER, req.requestId);
  next();
};
