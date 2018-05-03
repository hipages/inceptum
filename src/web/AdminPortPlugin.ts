// tslint:disable:prefer-function-over-method
import * as http from 'http';
import * as e from 'express';
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { LogManager } from '../log/LogManager';
import { WebRoutingInspector } from './WebRoutingInspector';

const logger = LogManager.getLogger(__filename);

export default class AdminPortPlugin implements Plugin {

  public static CONTEXT_APP_KEY = 'AdminPortPlugin/APP';
  public static CONTEXT_SERVER_KEY = 'AdminPortPlugin/SERVER';

  name = 'AdminPortPlugin';

  willStart(app: BaseApp, pluginContext: PluginContext) {
    const express = e();
    pluginContext.set(AdminPortPlugin.CONTEXT_APP_KEY, express);
    const context = app.getContext();
  }

  didStart(app, pluginContext) {
    const express = pluginContext.get(AdminPortPlugin.CONTEXT_APP_KEY);
    const port = app.getConfig('app.admin.port', 3001);

    // Start the server
    const server = express.listen(port, () => {
      app.logger.info(`Admin server started at http://localhost:${port}`);
    });
    pluginContext.set(AdminPortPlugin.CONTEXT_SERVER_KEY, server);
  }

  willStop(app, pluginContext) {
    const express = pluginContext.get(AdminPortPlugin.CONTEXT_SERVER_KEY);
    app.logger.info('Shutting down admin server');
    express.close();
  }
}
