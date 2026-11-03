// Standardized Error Classes for Policy & Approval Microservice

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'The policy evaluation request is invalid.', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required to access Policy & Approval service.', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Caller is not authorized for this policy or approval resource.', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'The requested policy or approval resource was not found.', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict with current resource state.', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Request body size exceeds configured limits.', details = null) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

class UnprocessableEntityError extends AppError {
  constructor(message = 'Policy expression or payload could not be processed.', details = null) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Rate limit exceeded.', details = null) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

class InternalServerError extends AppError {
  constructor(message = 'An unexpected internal error occurred within Policy Service.', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Policy & Approval Service dependency is currently unavailable.', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError
};
