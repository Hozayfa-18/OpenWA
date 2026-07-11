import { Request, Response, NextFunction } from 'express';

/**
 * Marks the legacy (unversioned) session/message/webhook routes as deprecated in
 * favour of their `/api/v1/...` equivalents (ADR-001). Adds standard
 * `Deprecation`, `Sunset` and `Link: rel="successor-version"` headers so clients
 * can migrate before the routes are removed.
 */
const SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';

export function deprecationHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', SUNSET);
  // Point at the versioned successor for the same path (/api/sessions… → /api/v1/sessions…).
  const successor = req.originalUrl.replace(/^\/api\//, '/api/v1/');
  res.setHeader('Link', `<${successor}>; rel="successor-version"`);
  next();
}
