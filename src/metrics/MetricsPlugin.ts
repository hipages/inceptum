// tslint:disable:prefer-function-over-method
import * as e from 'express';
import * as prometheus from 'prom-client';
import * as gcStats from 'prometheus-gc-stats';

import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import AdminPortPlugin from '../web/AdminPortPlugin';

export default class MetricsPlugin implements Plugin {
  name = 'MetricsPlugin';

  prometheusTimer: number;

  getName() {
    return this.name;
  }

  didStart(app: BaseApp, pluginContext: PluginContext) {
    this.prometheusTimer = (prometheus as any).defaultMetrics();
    // prometheus.register.setDefaultLabels({app: app.getConfig('app.name', 'not_set')});
    const startGcStats = gcStats();
    startGcStats();

    const context = app.getContext();
    const express: e.Express = pluginContext.get(AdminPortPlugin.CONTEXT_APP_KEY);
    if (express) {
      express.get('/metrics', async (req, res) => {
          res.type('text/plain');
          res.send(prometheus.register.metrics());
      });
    }
  }

  didStop() {
    if (this.prometheusTimer) {
      clearInterval(this.prometheusTimer);
    }
  }
}
