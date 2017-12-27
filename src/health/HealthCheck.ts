import { RegisterInGroup, Lazy } from '../ioc/Decorators';

export const HEALTH_CHECK_GROUP = 'inceptum:health';

export function RegisterAsHealthCheck(target: any) {
  RegisterInGroup(HEALTH_CHECK_GROUP)(target);
  Lazy(false)(target);
}

export enum HealthCheckStatus {
  OK = 'OK',
  NOT_READY = 'NOT_READY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

function getStatusIndex(status: HealthCheckStatus) {
  return [HealthCheckStatus.OK, HealthCheckStatus.NOT_READY, HealthCheckStatus.WARNING, HealthCheckStatus.CRITICAL].indexOf(status);
}

export class HealthCheckResult {
  timestamp: number;
  constructor(public status: HealthCheckStatus, public message: string, timestamp?: number, public data?: any) {
    this.timestamp = timestamp || new Date().getTime();
  }
  static getInitialResult(): HealthCheckResult {
    return new HealthCheckResult(HealthCheckStatus.NOT_READY, 'First check not run yet');
  }
  static staleResult(healthCheck: HealthCheck, lastResult: HealthCheckResult) {
    return new HealthCheckResult(HealthCheckStatus.CRITICAL, `Stale check result for check ${healthCheck.checkName}. Last result on ${lastResult.timestamp}`);
  }
}

export abstract class HealthCheck {
  started = false;
  lastResult: HealthCheckResult = HealthCheckResult.getInitialResult();
  timer: NodeJS.Timer;
  constructor(public checkName: string, public sleepMillis = 60000, public staleNumFails = 2) {}
  getCheckName(): string {
    return this.checkName;
  }
  getSleepMillis(): number {
    return this.sleepMillis;
  }
  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.doStart();
  }
  doStart() {
    this.timer = setInterval(() => {this.lastResult = this.doCheck(); }, this.getSleepMillis());
  }
  stop() {
    if (this.started && this.timer) {
      this.doStop();
    }
  }
  doStop() {
    clearInterval(this.timer);
  }
  isStarted(): boolean {
    return this.started;
  }
  abstract doCheck(): HealthCheckResult;
  getLastResult(): HealthCheckResult {
    const threshold = (new Date().getTime()) - this.getSleepMillis() * this.staleNumFails;
    if (this.lastResult.timestamp < threshold) {
      return HealthCheckResult.staleResult(this, this.lastResult);
    }
    return this.lastResult;
  }
}

export class HealthCheckGroup extends HealthCheck {
  groupKey: string;
  private healthChecks = new Map<string,HealthCheck>();
  constructor(groupName: string) {
    super(`Group: ${groupName}`, 0, 0);
    this.groupKey = groupName;
  }
  public addCheck(healthCheck: HealthCheck, asName?: string) {
    this.addCheckAs(healthCheck, asName || healthCheck.getCheckName());
  }
  public addCheckAs(healthCheck: HealthCheck, asName: string) {
    if (asName.indexOf('.') >= 0) {
      const parts = asName.split('.', 2);
      const group = this.healthChecks.get(parts[0]) as HealthCheckGroup;
      if (group && (group instanceof HealthCheckGroup)) {
        group.addCheckAs(healthCheck, parts[1]);
      } else if (group) {
        throw new Error(`A health check with name ${parts[0]} is already defined in this group`);
      } else {
        const newGroup = new HealthCheckGroup(parts[0]);
        newGroup.addCheckAs(healthCheck, parts[1]);
        this.addCheck(newGroup, parts[0]);
      }
    } else {
      this.healthChecks.set(asName, healthCheck);
      if (this.isStarted()) {
        healthCheck.start();
      }
    }
  }
  doStart() {
    this.healthChecks.forEach((healthCheck) => {
      healthCheck.start();
    });
  }
  doStop() {
    this.healthChecks.forEach((healthCheck) => {
      healthCheck.stop();
    });
  }
  public doCheck(): HealthCheckResult {
    throw new Error('This shouldn\'t be called. We override getLastResult to get up-to-date info');
  }
  getLastResult(): HealthCheckResult {
    const resp = new HealthCheckResult(HealthCheckStatus.OK, 'OK', new Date().getTime(), {});
    this.healthChecks.forEach((healthCheck, key) => {
      const lastResult = healthCheck.getLastResult();
      if (getStatusIndex(lastResult.status) > getStatusIndex(resp.status)) {
        resp.status = lastResult.status;
        resp.message = `Check ${healthCheck.getCheckName()} returned ${resp.status}`;
      }
      resp.data[key] = lastResult;
    });
    return resp;
  }
}
