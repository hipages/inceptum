import { Context } from '../ioc/Context';
import { LifecycleState } from '../ioc/Lifecycle';
import { AutowireContext } from '../ioc/Decorators';
import { HealthCheck, HealthCheckResult, HealthCheckStatus, RegisterAsHealthCheck } from './HealthCheck';

@RegisterAsHealthCheck
export class ContextReadyHealthCheck extends HealthCheck {

  @AutowireContext
  context: Context;

  constructor() {
    super('context', 5000);
  }

  public async doCheck(): Promise<HealthCheckResult> {
    if (!this.context) {
      return new HealthCheckResult(HealthCheckStatus.NOT_READY, `Context not wired`);
    }
    const contextStatus = this.context.getStatus();
    if (contextStatus === LifecycleState.NOT_STARTED || contextStatus === LifecycleState.STARTING) {
      return new HealthCheckResult(HealthCheckStatus.NOT_READY, `Context not ready. Still in status: ${contextStatus.getName()}`);
    } else if (contextStatus === LifecycleState.STARTED) {
      return new HealthCheckResult(HealthCheckStatus.OK, `Context STARTED`);
    } else {
      return new HealthCheckResult(HealthCheckStatus.WARNING, `Context STOPPING`);
    }
  }
}
