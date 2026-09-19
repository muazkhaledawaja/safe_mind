class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

class ConflictError extends AppError {
  constructor(code, message) {
    super(409, code, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super(403, 'FORBIDDEN', message);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid input', issues = []) {
    super(400, 'VALIDATION_ERROR', message);
    this.issues = issues;
  }
}

module.exports = { AppError, NotFoundError, ConflictError, ForbiddenError, UnauthorizedError, ValidationError };
