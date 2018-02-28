import HttpError from '../HttpError';

/**
 * 400 Bad Request
 * This response means that server could not understand the request due to invalid syntax.
 */
export class BadRequestError extends HttpError {
  constructor(message: string, cause?: Error) {
    super(400, message, cause);
  }
}
