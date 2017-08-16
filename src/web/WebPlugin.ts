// tslint:disable:prefer-function-over-method
import * as http from 'http';
import * as e from 'express';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';

export default class WebPlugin implements Plugin {

  public CONTEXT_APP_KEY = 'WebPlugin/APP';
  public CONTEXT_SERVER_KEY = 'WebPlugin/SERVER';

  name = 'WebPlugin';

  willStart(app: BaseApp, pluginContext: PluginContext) {
    const express = new e();
    pluginContext.set(this.CONTEXT_APP_KEY, express);
  }

  didStart(app, pluginContext) {
    const express = pluginContext.get(this.CONTEXT_APP_KEY);
    const port = app.getConfig('app.server.port', 10010);
    const server = express.listen(port, () => {
      app.logger.info(`Server listening on port ${port}`);
    });
    pluginContext.set(this.CONTEXT_SERVER_KEY, server);
  }

  willStop(app, pluginContext) {
    const express = pluginContext.get(this.CONTEXT_SERVER_KEY);
    app.logger.info('Shutting down server');
    express.close();
  }
}
