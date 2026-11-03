// Content Negotiation Middleware: JSON and XML Support
// Conforms to Web Services Assignment Module 2 Requirement 7

import { Request, Response, NextFunction } from 'express';
import { create } from 'xmlbuilder2';

function toXmlSafe(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { item: value.map(toXmlSafe) };
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
      result[safeKey] = toXmlSafe(val);
    }
    return result;
  }
  return value;
}

function toXml(data: unknown): string {
  return create({ response: toXmlSafe(data) }).end({ prettyPrint: true });
}

function wantsXmlOnly(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  const accept = acceptHeader.toLowerCase();
  if (accept.includes('application/json') || accept.includes('*/*')) return false;
  return accept.includes('application/xml') || accept.includes('text/xml');
}

function isUnsupportedFormat(acceptHeader: string | undefined): boolean {
  if (!acceptHeader || acceptHeader.trim() === '' || acceptHeader === '*/*') return false;
  const accept = acceptHeader.toLowerCase();
  const supported = [
    'application/json',
    'application/xml',
    'text/xml',
    '*/*',
    'text/html',
    'text/yaml'
  ];
  const tokens = accept.split(',').map((t) => t.trim().split(';')[0]);
  return !tokens.some((token) => supported.some((s) => token.includes(s) || s.includes(token)));
}

export function contentNegotiationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const acceptHeader = req.headers.accept;

  if (isUnsupportedFormat(acceptHeader)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(406).json({
      success: false,
      error: {
        code: 'NOT_ACCEPTABLE',
        message: `Unsupported Accept format: '${acceptHeader}'. Supported representations: application/json, application/xml.`,
        correlationId: req.correlationId || 'unknown',
        requestId: req.correlationId || 'unknown'
      }
    });
    return;
  }

  const originalJson = res.json.bind(res);

  res.json = function (body: any): Response {
    if (wantsXmlOnly(req.headers.accept)) {
      try {
        const xml = toXml(body);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        return res.send(xml);
      } catch {
        return originalJson(body);
      }
    }
    return originalJson(body);
  };

  next();
}

