require('express-yields');
const express = require('express');
const bodyParser = require('body-parser');
const { NotFoundError } = require('./NotFoundError');

class WebApp {
  configureExpressApp() {
    this.expressApp = express();
    // parse application/x-www-form-urlencoded
    this.expressApp.use(bodyParser.urlencoded({ extended: false }));
    // parse application/json
    this.expressApp.use(bodyParser.json());
    // app.use(auth);
    this.expressApp.use(this.mainRouter);
    this.expressApp.use(WebApp.httpErrorHandler);
  }

  static httpErrorHandler(err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
      res.status(401).json({ error: 'invalid token...' });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else {
      // process.env.NODE_ENV !== 'production' && console.error(err);
      next(err);
    }
  }
}

WebApp.autowire = {
  mainRouter: 'MainRouter'
};
WebApp.startFunction = 'configureExpressApp';

module.exports = { WebApp };
