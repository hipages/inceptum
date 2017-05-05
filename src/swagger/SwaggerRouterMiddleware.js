const logger = require('../log/LogManager').getLogger(__filename);

const optionParsingRegExp = /^\s*([^\s]*)\s*\((.*)\)/;
const optionParsingRegExp2 = /[a-zA-Z0-9?:@_-]+/g;

class SwaggerRouterMiddleware {
  constructor(context) {
    this.context = context;
    this.handlerCache = new Map();
  }
  hasController(req) {
    if (!req || !req.swagger) {
      return false;
    }
    if (req.swagger.operation && req.swagger.operation['x-swagger-router-controller']) {
      return true;
    }
    if (req.swagger.path && req.swagger.path['x-swagger-router-controller']) {
      return true;
    }
    return false;
  }
  register(expressApp) {
    const self = this;
    return new Promise((resolve) => {
      expressApp.use((req, res, next) => {
        try {
          if (self.hasController(req)) {
            // There's a controller to be called.
            self.getControllerHandler(req)
              .then(
                (handler) => {
                  const resp = handler(req, res);
                  if (resp && resp.then) {
                    resp.then(() => { next(); }, (err) => { next(err); });
                  } else {
                    next();
                  }
                },
                (err) => {
                  logger.warn(`Couldn't create handler for endpoint: ${err}`);
                });
          } else {
            // No controller defined, let it pass
            next();
          }
        } catch (e) {
          next(e);
        }
      });
      resolve();
    });
  }

  /**
   * @private
   * @param controllerName
   * @returns {*}
   */
  getControllerObjectPromise(controllerName) {
    return this.context.getObjectByName(controllerName);
  }

  /**
   * @private
   * @param req
   * @returns {Request}
   */
  getControllerHandler(req) {
    const controllerName = req.swagger.operation['x-swagger-router-controller'] ?
      req.swagger.operation['x-swagger-router-controller'] :
      req.swagger.path['x-swagger-router-controller'];
    const operationId = req.swagger.operation.operationId ?
      req.swagger.operation.operationId :
      req.method.toLowerCase();
    const key = `${controllerName}_${operationId}`;
    if (this.handlerCache.has(key)) {
      return Promise.resolve(this.handlerCache.get(key));
    }
    try {
      return this.getControllerObjectPromise(controllerName)
        .then((controller) => this.createControllerArgHandler(controller, operationId))
        .then((handler) => {
          this.handlerCache.set(key, handler);
          return handler;
        }, (err) => {
          logger.error(err, `There was an error creating the handler for ${key}`);
          throw err;
        });
    } catch (e) {
      logger.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * @private
   * @param controller
   * @param operationId
   * @returns {function(*=, *=)}
   */
  createControllerArgHandler(controller, operationId) {
    let functionName;
    let params = [];
    if (operationId.indexOf('(') < 0) {
      functionName = operationId.trim();
    } else {
      const matches = operationId.match(optionParsingRegExp);
      functionName = matches[1];
      if (matches[2].trim().length > 0) {
        params = matches[2].match(optionParsingRegExp2);
      }
    }
    const paramFunctions = [];
    params.forEach((param) => {
      if (param === 'null') {
        paramFunctions.push(() => null);
      } else {
        paramFunctions.push((req) => req.swagger.params[param].value);
      }
    });
    paramFunctions.push((req) => req);
    paramFunctions.push((req, res) => res);
    return (req, res) => {
      const args = paramFunctions.map((f) => f(req, res));
      return controller[functionName](...args);
    };
  }
}

module.exports = { SwaggerRouterMiddleware };
