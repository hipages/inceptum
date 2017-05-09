const logger = require('../log/LogManager').getLogger(__filename);
const { Command } = require('../cqrs/command/Command');

const SWAGGER_CQRS_PROPERTY = 'x-inceptum-cqrs-commmand';

class SwaggerCQRSMiddleware {
  /**
   *
   * @param {CQRS} cqrs
   */
  constructor(cqrs) {
    this.cqrs = cqrs;
    this.handlerCache = new Map();
  }

  /**
   * @private
   * @param req
   * @returns {boolean}
   */
  hasCQRSCommand(req) {
    return !!this.getCQRSCommand(req);
  }

  /**
   * @private
   * @param req
   * @returns {*}
   */
  getCQRSCommand(req) {
    if (!req || !req.swagger) {
      return undefined;
    }
    if (req.swagger.operation && req.swagger.operation[SWAGGER_CQRS_PROPERTY]) {
      return req.swagger.operation[SWAGGER_CQRS_PROPERTY];
    }
    if (req.swagger.path && req.swagger.path[SWAGGER_CQRS_PROPERTY]) {
      return req.swagger.path[SWAGGER_CQRS_PROPERTY];
    }
    return undefined;
  }

  register(expressApp) {
    const self = this;
    return new Promise((resolve) => {
      logger.debug('Registering CQRS middleware');
      expressApp.use((req, res, next) => {
        try {
          if (self.hasCQRSCommand(req)) {
            // There's a controller to be called.
            self.handleCQRSCommand(req, res);
          }
          // No cqrs command defined, let it pass
          next();
        } catch (e) {
          next(e);
        }
      });
      resolve();
    });
  }

  /**
   * @private
   * @param req
   * @returns {Request}
   */
  handleCQRSCommand(req, res) {
    const cqrsCommand = this.getCQRSCommand(req);
    if (cqrsCommand.indexOf(':') > 0) {
      const parts = cqrsCommand.split(':', 2);
      return this.handleCQRSCommandWithName(req, res, parts[0], parts[1]);
    }
    return this.handleCQRSCommandWithName(req, res, cqrsCommand, 'body');
  }

  /**
   * @private
   * @param req
   * @param res
   * @param commandName
   * @param bodyParamName
   * @returns {*}
   */
  handleCQRSCommandWithName(req, res, commandName, bodyParamName) {
    const payload = this.getPayload(req, bodyParamName);
    const command = Command.fromObject(payload || {}, commandName);
    console.log(payload, command);
    const executionContext = this.cqrs.executeCommand(command);
    if (executionContext.hasCommandResultForCommand(command)) {
      const commandResult = executionContext.getCommandResultForCommand(command);
      if (commandResult.hasNewAggregateId()) {
        res.status(201);
      } else {
        res.status(200);
      }
      res.send(commandResult);
    } else {
      res.status(204);
      res.send('');
    }
  }

  /**
   * @private
   * @param req
   * @param bodyParamName
   * @returns {*}
   */
  getPayload(req, bodyParamName) {
    if (req.swagger.params && req.swagger.params[bodyParamName]) {
      return req.swagger.params[bodyParamName];
    }
    return undefined;
  }
}

module.exports = { SwaggerCQRSMiddleware };
