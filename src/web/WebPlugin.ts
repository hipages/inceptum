// tslint:disable:prefer-function-over-method
import * as http from 'http';
import * as e from 'express';
import { Plugin } from '../app/BaseApp';

export default class WebPlugin implements Plugin {

  name = 'Web-Plugin';

  willStart(app, pluginContext) {
    const express = new e();
    pluginContext.set('web-app', express);
  }

  didStart(app, pluginContext) {
    const express = pluginContext.get('web-app');
    const port = app.getConfig('app.server.port', 10010);
    const server = express.listen(port, () => {
      app.logger.info(`Server listening on port ${port}`);
    });
    pluginContext.set('web-server', server);
  }

  willStop(app, pluginContext) {
    const express = pluginContext.get('web-server');
    app.logger.info('Shutting down server');
    express.close();
  }
}
