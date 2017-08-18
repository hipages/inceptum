export default class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
  getStatusCode() {
    return this.statusCode;
  }

  static notFound(message) {
    return new HttpError(404, message);
  }
}
