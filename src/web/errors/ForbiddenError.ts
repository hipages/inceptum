import HttpError from '../HttpError';

export class ForbiddenError extends HttpError {
  constructor(message: string, cause?: Error) {
    super(403, message, cause);
  }
}
