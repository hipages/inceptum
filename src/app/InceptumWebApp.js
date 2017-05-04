const { InceptumApp } = require('./InceptumApp');
const createApplication = require('express');

class InceptumWebApp extends InceptumApp {
  constructor() {
    super();
    this.app = createApplication();
  }
  // getExpressApp() {
  //   return this.app;
  // }
  start() {
    if (this.configurator) {
      try {
        const resp = this.configurator(this.app);
        if (resp && resp.then) {
          return this.doInternalStart(resp);
        }
        return this.doInternalStart(Promise.resolve(resp));
      } catch (e) {
        Promise.reject(new Error(`There was an error calling the configurator: ${e.message}`));
      }
    }
    return this.doInternalStart(Promise.resolve());
  }

  /**
   *
   * @private
   * @param {Promise} promise
   * @returns {Promise.<TResult>}
   */
  doInternalStart(promise) {
    const self = this;
    return promise
      .then(super.start())
      .then(() => {
        self.port = process.env.PORT || this.getConfig('app.server.port', 10010);
        self.server = self.app.listen(self.port, () => {
          self.logger.info(`Server listening on port ${self.port}`);
        });
      });
  }
  stop() {
    const theServer = this.server;
    return Promise.resolve()
      .then(() => {
        try {
          theServer.close();
        } catch (e) {
          this.logger.error('There was an error stopping the server', e);
        }
      })
      .then(super.stop());
  }

  /**
   * A funtion that will be called before the app is started.
   * This function
   * @param {Function} configurator The function to call. This function may return a Promise. If it does,
   * the rest of the configuration and startup will be then-ed to it.
   * @param {Object} configurator(app) The function receives as parameter the Express App that it must configure
   */
  setAppConfigurator(configurator) {
    this.configurator = configurator;
  }
}

module.exports = { InceptumWebApp };
