const { InceptumWebApp } = require('./InceptumWebApp');
const { SwaggerMetadataMiddleware } = require('../swagger/SwaggerMetadataMiddleware');
const { SwaggerRouterMiddleware } = require('../swagger/SwaggerRouterMiddleware');

class InceptumSwaggerApp extends InceptumWebApp {
  constructor(swaggerFilePath) {
    super();
    this.swaggerFilePath = swaggerFilePath;
    this.setConfigurator();
  }
  setAppConfigurator() {
    throw new Error('Don\'t call setAppConfigurator on an InceptumSwaggerApp. ' +
      'Instead call the setPreSwaggerAppConfigurator and setPostSwaggerAppConfigurator');
  }

  /**
   * @private
   */
  setConfigurator() {
    const self = this;
    super.setAppConfigurator((app) => self.getPreSwaggerPromise(app)
      .then(() => self.getSwaggerMetadataMiddlewarePromise(app))
      .then(() => self.getSwaggerRouterMiddlewarePromise(app))
        .then(() => self.getPostSwaggerPromise(app)));
  }

  /**
   * @private
   */
  getPreSwaggerPromise(app) {
    if (this.preSwaggerConfigurator) {
      try {
        this.logger.debug('Executing preSwaggerConfigurator');
        const resp = this.preSwaggerConfigurator(app);
        if (resp && resp.then) return resp;
        return Promise.resolve(resp);
      } catch (e) {
        this.logger.error(e, 'There was an error executing PreSwaggerConfigurator');
        return Promise.reject(new Error(`There was an error executing PreSwaggerConfigurator: ${e.message}`));
      }
    }
    return Promise.resolve();
  }

  /**
   * @private
   */
  getPostSwaggerPromise(app) {
    if (this.postSwaggerConfigurator) {
      try {
        this.logger.debug('Executing postSwaggerConfigurator');
        const resp = this.postSwaggerConfigurator(app);
        if (resp && resp.then) return resp;
        return Promise.resolve(resp);
      } catch (e) {
        this.logger.error(e, 'There was an error executing PostSwaggerConfigurator');
        return Promise.reject(new Error(`There was an error executing PostSwaggerPromise: ${e.message}`));
      }
    }
    return Promise.resolve();
  }

  getSwaggerMetadataMiddlewarePromise(app) {
    try {
      this.logger.debug('Executing getSwaggerMetadataMiddlewarePromise');
      const sm = new SwaggerMetadataMiddleware({ swaggerFilePath: this.swaggerFilePath });
      return sm.register(app);
    } catch (e) {
      this.logger.error(e, 'There was an error creating Swagger Metadata Middleware');
      return Promise.reject(new Error(`There was an error creating Swagger Metadata Middleware: ${e.message}`));
    }
  }

  getSwaggerRouterMiddlewarePromise(app) {
    try {
      this.logger.debug('Executing getSwaggerRouterMiddlewarePromise');
      const sr = new SwaggerRouterMiddleware(this.getContext());
      return sr.register(app);
    } catch (e) {
      this.logger.error(e, 'There was an error creating Swagger Router Middleware');
      return Promise.reject(new Error(`There was an error creating Swagger Router Middleware: ${e.message}`));
    }
  }

  setPreSwaggerAppConfigurator(configurator) {
    this.preSwaggerConfigurator = configurator;
  }
  setPostSwaggerAppConfigurator(configurator) {
    this.postSwaggerConfigurator = configurator;
  }
}

module.exports = { InceptumSwaggerApp };
