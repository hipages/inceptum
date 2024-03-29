// tslint:disable:prefer-function-over-method
import * as http from 'http';
import * as e from 'express';
import * as onFinished from 'on-finished';
import { ExtendedGauge } from 'prometheus-extended-gauge';
import * as promBundle from 'express-prom-bundle';
import * as xmlparser from 'express-xml-bodyparser';
import { processors, OptionsV2 as xml2jsOptionsV2 } from 'xml2js';
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { LogManager } from '../log/LogManager';
import { WebRoutingInspector } from './WebRoutingInspector';
import HttpError from './HttpError';
import { ContentNegotiationMiddleware } from './ContentNegotiationMiddleware';

const logger = LogManager.getLogger(__filename);

const activeRequestsGauge = new ExtendedGauge({
  max: true,
  min: false,
  average: true,
  bucketSizeMillis: 1000,
  numBuckets: 60,
  help: 'Number of active http requests being processed',
  name: 'http_active_requests',
});

export class RouteRegisterUtil {
  private routesToRegister = [];
  private express;

  doRegister() {
    this.routesToRegister.forEach((route: {verb: string, path: string, instanceProperty: string, methodName: string, objectName: string}) => {
      logger.info(`Registering route from ${route.objectName}: ${route.verb.toUpperCase()} ${route.path} -> ${route.methodName}`);
      this.express[route.verb](route.path, (req, res) => {
        return this[route.instanceProperty][route.methodName](req, res);
      });
    });
  }
}

/**
 * Client errors do not need to be sent to NewRelic so create clientErrorMiddleware
 * to send response if the error is 4xx. clientErrorMiddleware needs to be registered
 * before errorMiddleware.
 * @param err
 * @param req
 * @param res
 * @param next
 */
export const clientErrorMiddleware = (err, req, res, next) => {
  let more = [];
  if (err instanceof HttpError && err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ) {
    res.status(err.getStatusCode()).send({message: err.message});
  } else if (err.failedValidation) { // swagger-tools validation
    more = err.results && err.results.errors;
    res.status(400).send({message: err.message});
  } else {
    return next(err); // Give back to express to handle
  }
  logger.error({err, more}); // log 4xx errors and swagger errors
};

export const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err); // Give back to express to handle
  }

  logger.error(err);
  const data = {message: err.message};
  if (err instanceof HttpError && err.statusCode) {
    if (err.statusCode >= 500) {
      NewrelicUtil.noticeError(err);
    }
    res.status(err.getStatusCode()).send(data);
  } else {
    NewrelicUtil.noticeError(err);
    res.status(500).send(data);
  }
};

export interface WebPluginOptions {
  staticRoots?: string[],
  xmlBodyParserOptions?: xml2jsOptionsV2,
}

export default class WebPlugin implements Plugin {

  public static CONTEXT_APP_KEY = 'WebPlugin/APP';
  public static CONTEXT_SERVER_KEY = 'WebPlugin/SERVER';

  name = 'WebPlugin';
  // private expressProvider = () => new e();

  constructor(private options: WebPluginOptions = {}) {}

  willStart(app: BaseApp, pluginContext: PluginContext) {
    const express: e.Express = e();
    express.disable('x-powered-by');
    express.set('trust proxy', true); // stop redirecting to http internally https://expressjs.com/en/guide/behind-proxies.html
    pluginContext.set(WebPlugin.CONTEXT_APP_KEY, express);
    const context = app.getContext();

    express.use(promBundle({
      includeMethod: true,
      buckets: [0.003, 0.03, 0.1, 0.3, 0.5, 1.5, 10],
      autoregister: false,
    }));

    // Add middleware for stats on active requests
    express.use((req, res, next) => {
      activeRequestsGauge.inc();
      onFinished(res, () => activeRequestsGauge.dec());
      next();
    });

    this.registerXmlBodyParser(express);
    this.registerXmlContentNegotiationMiddleware(express, app.getConfig('app.xmlRoot', '') as string);

    // move from didStart to willStart
    express.use(e.json({ limit: app.getConfig('app.server.maxRequestSize','10mb') }));
    express.use(e.urlencoded({ extended: true, limit: app.getConfig('app.server.maxRequestSize','10mb') }));

    if (this.options && this.options.staticRoots) {
      this.options.staticRoots.forEach((root) => {
        express.use(e.static(root));
      });
    }

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
    express.use(clientErrorMiddleware);
    // Add error handling middleware as the final middleware.
    express.use(errorMiddleware);

    // Start the server
    const server = express.listen(port, () => {
      app.logger.info(`Server started at http://localhost:${port}`);
    });
    pluginContext.set(WebPlugin.CONTEXT_SERVER_KEY, server);
  }

  didStop(app, pluginContext) {
    const express = pluginContext.get(WebPlugin.CONTEXT_SERVER_KEY);
    app.logger.info('Shutting down server');
    if (express) {
      express.close();
    }
  }

  protected registerXmlBodyParser(express: e.Express) {
    if (this.options && this.options.xmlBodyParserOptions) {
      express.use(xmlparser(this.options.xmlBodyParserOptions));
    }
  }

  protected registerXmlContentNegotiationMiddleware(express: e.Express, xmlRoot: string) {
    const negoContentMiddleware = new ContentNegotiationMiddleware(xmlRoot);
    const xmlMiddleware = negoContentMiddleware.getMiddleware();
    if (xmlMiddleware) {
      express.use(xmlMiddleware);
    }
  }
}
