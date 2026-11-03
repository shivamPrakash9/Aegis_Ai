// Standardized Application Error Hierarchy for Model & Provider Microservice

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Invalid request payload or parameters', details = undefined) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = undefined) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication credential is missing or invalid') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access to this resource or model is forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ModelNotFoundError extends AppError {
  constructor(message = 'Requested model is not registered or supported') {
    super(message, 404, 'MODEL_NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource state conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Provider or service rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class BadGatewayError extends AppError {
  constructor(message = 'Upstream LLM provider returned an invalid or error response') {
    super(message, 502, 'BAD_GATEWAY');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Model & Provider Service or upstream provider is temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

class GatewayTimeoutError extends AppError {
  constructor(message = 'Upstream provider timed out processing completion request') {
    super(message, 504, 'GATEWAY_TIMEOUT');
  }
}

module.exports = {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ModelNotFoundError,
  ConflictError,
  RateLimitError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError
};
