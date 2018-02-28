import HttpError from '../HttpError';

/**
 * 401 Unauthorized
 * Although the HTTP standard specifies "unauthorized",
 * semantically this response means "unauthenticated".
 * That is, the client must authenticate itself to get the requested response.
 */
export class UnauthorizedError extends HttpError {
  constructor(message: string, cause?: Error) {
    super(401, message, cause);
  }
}
