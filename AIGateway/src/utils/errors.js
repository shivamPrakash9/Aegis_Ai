// Standard Error Classes for AegisAI AI Gateway

class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Invalid request payload or parameters', details) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized or missing credentials', details) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden for caller context', details) {
    super(403, 'FORBIDDEN', message, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found', details) {
    super(404, 'NOT_FOUND', message, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource state conflict', details) {
    super(409, 'CONFLICT', message, details);
  }
}

class ContentTooLargeError extends AppError {
  constructor(message = 'Request payload exceeds maximum allowed size', details) {
    super(413, 'CONTENT_TOO_LARGE', message, details);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Rate limit exceeded for caller or organization', details) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, details);
  }
}

class BadGatewayError extends AppError {
  constructor(message = 'Invalid or malformed response from downstream service', details) {
    super(502, 'BAD_GATEWAY', message, details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Mandatory downstream security or model service unavailable', details) {
    super(503, 'SERVICE_UNAVAILABLE', message, details);
  }
}

class GatewayTimeoutError extends AppError {
  constructor(message = 'Downstream provider or security service timed out', details) {
    super(504, 'GATEWAY_TIMEOUT', message, details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ContentTooLargeError,
  TooManyRequestsError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError
};
