const uuid = require('uuid');

class IdGenerator {
  static setGenerator(func) {
    IdGenerator.generate = func;
  }
  /**
   * Generates an id
   * @param {string} type The type for which we need to generate an ID. E.g. 'Event', 'Command', etc
   */
  // eslint-disable-next-line no-unused-vars
  static generate(type) {
    throw new Error('Not implemented');
  }
}

IdGenerator.setGenerator(() => uuid.v1());

module.exports = { IdGenerator };
