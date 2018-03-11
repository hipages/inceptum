// tslint:disable:prefer-function-over-method
import * as http from 'http';
import * as e from 'express';
import * as promBundle from 'express-prom-bundle';
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { LogManager } from '../log/LogManager';
import { WebRoutingInspector } from './WebRoutingInspector';
import HttpError from './HttpError';

const logger = LogManager.getLogger(__filename);

export class RouteRegisterUtil {
  private routesToRegister = [];
  private express: e;

  doRegister() {
    this.routesToRegister.forEach((route: {verb: string, path: string, instanceProperty: string, methodName: string, objectName: string}) => {
      logger.info(`Registering route from ${route.objectName}: ${route.verb.toUpperCase()} ${route.path} -> ${route.methodName}`);
      this.express[route.verb](route.path, (req, res) => {
        return this[route.instanceProperty][route.methodName](req, res);
      });
    });
  }
}

export const errorMiddleware = (err, req, res, next) => {
  if (NewrelicUtil.isNewrelicAvailable()) {
    const nr = NewrelicUtil.getNewrelicIfAvailable();
    nr.noticeError(nr);
  }
  logger.error(err);
  if (res.headersSent) {
      return next(err); // Give back to express to handle
  }

  if (err instanceof HttpError && err.statusCode) {
    res.status(err.getStatusCode()).send({message: err.message});
  } else {
    res.status(500).end();
  }
};

export default class WebPlugin implements Plugin {

  public static CONTEXT_APP_KEY = 'WebPlugin/APP';
  public static CONTEXT_SERVER_KEY = 'WebPlugin/SERVER';

  name = 'WebPlugin';
  private expressProvider = () => new e();

  willStart(app: BaseApp, pluginContext: PluginContext) {
    const express = this.expressProvider();
    express.set('trust proxy', true); // stop redirecting to http internally https://expressjs.com/en/guide/behind-proxies.html
    pluginContext.set(WebPlugin.CONTEXT_APP_KEY, express);
    const context = app.getContext();

    express.use(promBundle({
      includeMethod: true,
      buckets: [0.003, 0.03, 0.1, 0.3, 0.5, 1.5, 10],
      autoregister: false,
    }));

    const definition = new BaseSingletonDefinition<RouteRegisterUtil>(RouteRegisterUtil);
    definition.withLazyLoading(false);
    definition.startFunction('doRegister');
    definition.setPropertyByValue('express', express);
    context.registerDefinition(definition);
    context.addObjectDefinitionInspector(new WebRoutingInspector(definition));
  }

  didStart(app, pluginContext) {
    const express = pluginContext.get(WebPlugin.CONTEXT_APP_KEY);
    const port = app.getConfig('app.server.port', 10010);

    // Add error handling middleware as the final middleware.
    express.use(errorMiddleware);

    // Start the server
    const server = express.listen(port, () => {
      app.logger.info(`Server started at http://localhost:${port}`);
    });
    pluginContext.set(WebPlugin.CONTEXT_SERVER_KEY, server);
  }

  willStop(app, pluginContext) {
    const express = pluginContext.get(WebPlugin.CONTEXT_SERVER_KEY);
    app.logger.info('Shutting down server');
    if (express) {
      express.close();
    }
  }
}
