import { Context } from '../ioc/Context';
import { LifecycleState } from '../ioc/Lifecycle';
import { AutowireContext } from '../ioc/Decorators';
import { HealthCheck, HealthCheckResult, RegisterAsHealthCheck, createResult, HealthCheckState } from './HealthCheck';

@RegisterAsHealthCheck
export class ContextReadyHealthCheck implements HealthCheck {

  @AutowireContext
  context: Context;

  name: 'ContextReady';

  async status() {
    if (!this.context) {
      return createResult(HealthCheckState.PENDING , 'No context found');
    }
    const contextStatus = this.context.getStatus();
    if (contextStatus === LifecycleState.NOT_STARTED || contextStatus === LifecycleState.STARTING) {
      return createResult(HealthCheckState.NOT_READY, `Context currently: ${contextStatus.getName()}`);
    } else if (contextStatus === LifecycleState.STARTED) {
      return createResult(HealthCheckState.OK);
    } else {
      return createResult(HealthCheckState.NOT_READY, `Context currently: ${contextStatus.getName()}`);
    }
  }
}
