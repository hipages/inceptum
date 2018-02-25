import HttpError from '../HttpError';

export class BadRequestError extends HttpError {
  constructor(message: string, cause?: Error) {
    super(400, message, cause);
  }
}
