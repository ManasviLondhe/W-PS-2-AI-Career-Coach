import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal error occurred.';

  // Never expose sensitive internal traces or credentials
  const responsePayload = {
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
    },
  };

  if (env.NODE_ENV === 'development' && statusCode === 500) {
    responsePayload.error.stack = err.stack;
  }

  console.error(`[Error] ${req.method} ${req.path} -> ${statusCode}: ${message}`);
  res.status(statusCode).json(responsePayload);
}
