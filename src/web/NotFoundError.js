class NotFoundError extends Error {
  constructor(message, context) {
    super(message);
    this.context = context;
  }
}

module.exports = { NotFoundError };
