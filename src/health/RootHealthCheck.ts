import { AutowireGroup, StartMethod, Lazy } from '../index';
import {HealthCheck, HealthCheckGroup, HEALTH_CHECK_GROUP } from './HealthCheck';

@Lazy(false)
export default class RootHealthCheck extends HealthCheckGroup {
  @AutowireGroup(HEALTH_CHECK_GROUP)
  healthChecksToRegister: HealthCheck[] = [];

  @StartMethod
  start() {
    for (const check of this.healthChecksToRegister) {
      this.add(check);
    }
  }
}
