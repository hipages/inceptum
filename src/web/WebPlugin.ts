// tslint:disable:prefer-function-over-method
import * as http from 'http';
import * as e from 'express';
import { Plugin } from '../app/BaseApp';

export default class WebPlugin extends Plugin {

  name = 'Web-Plugin';

  willStart(app, pluginContext) {
    const express = new e();
    pluginContext.set('web-app', express);
  }

  didStart(app, pluginContext) {
    const express = pluginContext.get('web-app');
    pluginContext.set('web-server', express);
    const port = app.getConfig('app.server.port', 10010);
    const serverr = express.listen(port, () => {
      app.logger.info(`Server listening on port ${port}`);
    });
  }

  willStop(app, pluginContext) {
    const express = pluginContext.get('server');
    app.logger.info('Shutting down server');
    express.close();
  }
}
