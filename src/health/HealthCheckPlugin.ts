import * as e from 'express';

import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { AutowireGroup, Lazy, StartMethod, StopMethod } from '../ioc/Decorators';
import AdminPortPlugin from '../web/AdminPortPlugin';
import { LogManager } from '../log/LogManager';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { HealthCheck, HealthCheckGroup, HealthCheckStatus, HEALTH_CHECK_GROUP } from './HealthCheck';
import { ContextReadyHealthCheck } from './ContextReadyHealthCheck';


const logger = LogManager.getLogger(__filename);

@Lazy(false)
export class HealthCheckManager extends HealthCheckGroup {
  @AutowireGroup(HEALTH_CHECK_GROUP)
  healthChecksToRegister: HealthCheck[] = [];

  @StartMethod
  start() {
    this.healthChecksToRegister.forEach((healthCheck) => {
      logger.debug(`Registering health check: ${healthCheck.getCheckName()}`);
      this.addCheck(healthCheck);
    });
    super.start();
  }

  @StopMethod
  stop() {
    super.stop();
  }
}

export default class HealthCheckPlugin implements Plugin {
  name = 'HealthCheckPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp, pluginContext: PluginContext) {
    const context = app.getContext();
    context.registerSingletons(HealthCheckManager, ContextReadyHealthCheck);
  }

  didStart(app: BaseApp, pluginContext: PluginContext) {
    const context = app.getContext();
    const express: e.Express = pluginContext.get(AdminPortPlugin.CONTEXT_APP_KEY);
    if (express) {
      express.get('/health', async (req, res) => {
        NewrelicUtil.setIgnoreTransaction(true);
        const healthCheckManager: HealthCheckManager = await context.getObjectByName('HealthCheckManager');
        const healthCheckResult = healthCheckManager.getLastResult();

        if (healthCheckResult.status === HealthCheckStatus.OK || healthCheckResult.status === HealthCheckStatus.NOT_READY) {
          res.send(healthCheckResult);
        } else {
          res.status(503).send(healthCheckResult);
        }
      });
    }
  }
}
