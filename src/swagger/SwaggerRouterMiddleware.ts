// tslint:disable:prefer-function-over-method

import { NewrelicUtil } from '../newrelic/NewrelicUtil';

const optionParsingRegExp = /^\s*([^\s]*)\s*\((.*)\)/;
const optionParsingRegExp2 = /[a-zA-Z0-9?:@_-]+/g;
const SWAGGER_CONTROLLER_PROPERTY = 'x-inceptum-controller';
const SWAGGER_OPERATION_PROPERTY = 'x-inceptum-operation';

const newrelic = NewrelicUtil.getNewrelicIfAvailable();

function assert(predicate, message) {
  if (!predicate) {
      throw new Error(message);
  }
}

const getControllerName = (req) => req.swagger.operation[SWAGGER_CONTROLLER_PROPERTY]
? req.swagger.operation[SWAGGER_CONTROLLER_PROPERTY]
: req.swagger.path[SWAGGER_CONTROLLER_PROPERTY];

const getOperationName = (req) => req.swagger.operation[SWAGGER_OPERATION_PROPERTY]
? req.swagger.operation[SWAGGER_OPERATION_PROPERTY]
: req.method.toLowerCase();

export default class SwaggerRouterMiddleware {
  context: any;
  handlerCache: Map<string, any>;

  constructor(context) {
    this.context = context;
    this.handlerCache = new Map();
  }
  hasController(req) {
    if (!req || !req.swagger) {
      return false;
    }
    if (req.swagger.operation && req.swagger.operation[SWAGGER_CONTROLLER_PROPERTY]) {
      return true;
    }
    if (req.swagger.path && req.swagger.path[SWAGGER_CONTROLLER_PROPERTY]) {
      return true;
    }
    return false;
  }
  async register(expressApp) {
    expressApp.use(async (req, res, next) => {
      if (newrelic && req.swagger && req.swagger.path) {
        newrelic.setTransactionName(req.swagger.path);
      }

      try {
        if (this.hasController(req)) {
          const handler = await this.getControllerHandler(req);
          assert(handler, `Could not find handler for ${getControllerName(req)}#${getOperationName(req)}. Make sure there is a matching class/method registered on the context.`);
          try {
            const resp = await handler(req, res);
            assert(res.headersSent, `${getControllerName(req)}#${getOperationName(req)} was called but didn't handle the request. Make sure you always handle the request by calling an appopriate method on "res"`);
          } catch (error) {
            next(error); // Send to express error handler
          }
        } else {
          next(); // Not handled, continue up the middleware chain
        }
      } catch (e) {
        next(e); // Send to express error handler
      }
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
   * @returns Function
   */
  async getControllerHandler(req) {
    const controllerName = getControllerName(req);
    const operationId = getOperationName(req);
    const key = `${controllerName}_${operationId}`;

    if (this.handlerCache.has(key)) {
      return this.handlerCache.get(key);
    }
    const controller = await this.getControllerObjectPromise(controllerName);
    if (controller) {
      const handler = this.createControllerArgHandler(controller, operationId);
      if (handler) {
        this.handlerCache.set(key, handler);
        return handler;
      }
    }
  }

  /**
   * @private
   * @param controller
   * @param operationId
   * @returns {function(*=, *=)|null}
   */
  createControllerArgHandler(controller: any, operationId: string): Function|void {
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

    if (!controller[functionName]) {
      return;
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
