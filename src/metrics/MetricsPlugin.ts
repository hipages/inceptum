// tslint:disable:prefer-function-over-method
import * as e from 'express';
import * as prometheus from 'prom-client';
import * as gcStats from 'prometheus-gc-stats';

import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import AdminPortPlugin from '../web/AdminPortPlugin';
import { LogManager } from '../log/LogManager';
import WebPlugin from '../web/WebPlugin';

const Logger = LogManager.getLogger(__filename);

export default class MetricsPlugin implements Plugin {
  name = 'MetricsPlugin';

  prometheusTimer: number;

  getName() {
    return this.name;
  }

  didStart(app: BaseApp, pluginContext: PluginContext) {
    this.prometheusTimer = prometheus.collectDefaultMetrics();
    prometheus.register.setDefaultLabels({app: app.getConfig('app.name', 'not_set')});
    const startGcStats = gcStats();
    startGcStats();

    const context = app.getContext();
    const adminExpress: e.Express = pluginContext.get(AdminPortPlugin.CONTEXT_APP_KEY);
    if (adminExpress) {
      Logger.info('Registering metrics endpoint in Admin port');
      adminExpress.get('/metrics', async (req, res) => {
          res.type('text/plain');
          res.send(prometheus.register.metrics());
      });
    }
  }

  didStop() {
    prometheus.register.clear();
    if (this.prometheusTimer) {
      Logger.info('Shutting down prometheus interval');
      clearInterval(this.prometheusTimer);
    }
  }
}
