import { HealthCheck, HealthCheckResult, HealthCheckStatus, RegisterAsHealthCheck } from '../health/HealthCheck';
import { Logger, LogManager } from '../log/LogManager';
import { Autowire } from '../ioc/Decorators';
import { RabbitmqClient } from './RabbitmqClient';
import { RabbitmqMgtHttpApi, RabbitmqNodeHealthCheckResult } from './RabbitmqMgtHttpApi';

const logger = LogManager.getLogger(__filename);
@RegisterAsHealthCheck
export class RabbitmqHealthCheck extends HealthCheck {
  @Autowire('RabbitmqMgtHttpApi')
  rabbitmqMgtHttpApi: RabbitmqMgtHttpApi;
  protected logger: Logger;

  constructor(name: string) {
    super(name, 60000, 2, true);
    this.logger = logger;
  }

  async doCheck(): Promise<HealthCheckResult> {
    if (!this.rabbitmqMgtHttpApi) {
      return Promise.resolve(new HealthCheckResult(HealthCheckStatus.NOT_READY, 'Rabbitmq Management Http API not set yet'));
    }

    if (!this.rabbitmqMgtHttpApi.rabbitmqConfig.healthCheckEnabled) {
      return Promise.resolve(new HealthCheckResult(HealthCheckStatus.OK, 'Health check DISABLED'));
    }

    try {
      const res: RabbitmqNodeHealthCheckResult = await this.rabbitmqMgtHttpApi.ping();
      if (res.status.toUpperCase() === HealthCheckStatus.OK) {
        return Promise.resolve(new HealthCheckResult(HealthCheckStatus.OK, 'Ping OK'));
      } else {
        return Promise.resolve(new HealthCheckResult(HealthCheckStatus.CRITICAL, res.reason));
      }
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }


}
