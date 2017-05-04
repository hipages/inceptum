const { InceptumWebApp } = require('./InceptumWebApp');
const { SwaggerMetadataMiddleware } = require('../swagger/SwaggerMetadataMiddleware');

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
        .then(() => self.getAddSwaggerMiddlewarePromise(app))
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

  getAddSwaggerMiddlewarePromise(app) {
    try {
      this.logger.debug('Executing addSwaggerMiddleware');
      const sm = new SwaggerMetadataMiddleware({ swaggerFilePath: this.swaggerFilePath });
      return sm.register(app);
    } catch (e) {
      this.logger.error(e, 'There was an error creating Swagger Middleware');
      return Promise.reject(new Error(`There was an error creating Swagger Middleware: ${e.message}`));
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
