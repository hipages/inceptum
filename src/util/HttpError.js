
class HttpError extends Error {
  constructor(statusCode, message) {
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

module.exports = { HttpError };
