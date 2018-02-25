import { ExtendedError } from '../util/ErrorUtil';
export default class HttpError extends ExtendedError {
  statusCode: number;
  constructor(statusCode: number, message: string, cause?: Error) {
    super(message, cause);
    this.statusCode = statusCode;
  }
  getStatusCode() {
    return this.statusCode;
  }

  static notFound(message) {
    return new HttpError(404, message);
  }
}
