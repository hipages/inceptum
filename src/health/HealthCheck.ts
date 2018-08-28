import { RegisterInGroup, Lazy } from '../ioc/Decorators';
import { LogManager } from '../log/LogManager';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';

const LOGGER = LogManager.getLogger(__filename);
export const HEALTH_CHECK_GROUP = 'inceptum:health';

export function RegisterAsHealthCheck(target: any) {
  RegisterInGroup(HEALTH_CHECK_GROUP)(target);
  Lazy(false)(target);
}

export enum HealthCheckState {
  PENDING = 0,
  OK = 1,
  NOT_READY = 2,
  ERROR = 3,
}

export interface HealthCheckResult {
  state: HealthCheckState,
  timestamp: Date,
  data?: any,
}

export function createResult(state: HealthCheckState, data?: any): HealthCheckResult {
  return {
    state,
    timestamp: new Date(),
    data,
  };
}

export interface HealthCheck {
  name: string,
  status(): Promise<HealthCheckResult>,
}


export class HealthCheckGroup implements HealthCheck {
  name: string;
  checks: HealthCheck[] = [];
  constructor(name: string) {
    this.name = name;
  }

  add(check: HealthCheck) {
    this.checks.push(check);
  }

  async status() {
    const results = await Promise.all(this.checks.map((check) => check.status()));
    return {
      state: Math.max(...results.map((res) => res.state as number)),
      timestamp: new Date(),
      data: results,
    };
  }
}
