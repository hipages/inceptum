import * as e from 'express';

import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { AutowireGroup, Lazy, StartMethod, StopMethod } from '../ioc/Decorators';
import AdminPortPlugin from '../web/AdminPortPlugin';
import { LogManager } from '../log/LogManager';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { HealthCheck, HealthCheckState, HealthCheckGroup, HEALTH_CHECK_GROUP } from './HealthCheck';
import { ContextReadyHealthCheck } from './ContextReadyHealthCheck';
import RootHealthCheck from './RootHealthCheck';

const logger = LogManager.getLogger(__filename);

export default class HealthCheckPlugin implements Plugin {
  name = 'HealthCheckPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp, pluginContext: PluginContext) {
    const context = app.getContext();
    context.registerSingletons(RootHealthCheck, ContextReadyHealthCheck);
  }

  didStart(app: BaseApp, pluginContext: PluginContext) {
    const context = app.getContext();
    const express: e.Express = pluginContext.get(AdminPortPlugin.CONTEXT_APP_KEY);
    if (express) {
      express.get('/health', async (req, res) => {
        NewrelicUtil.setIgnoreTransaction(true);
        const healthCheckManager: RootHealthCheck = await context.getObjectByName('HealthCheckManager');
        const healthCheckResult =  await healthCheckManager.status();

        if (healthCheckResult.state === HealthCheckState.OK || HealthCheckState.PENDING) {
          res.send(healthCheckResult);
        } else {
          res.status(503).send(healthCheckResult);
        }
      });
    }
  }
}
