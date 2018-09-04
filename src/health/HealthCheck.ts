import { RegisterInGroup, Lazy } from '../ioc/Decorators';
import { LogManager } from '../log/LogManager';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';

const LOGGER = LogManager.getLogger(__filename);
export const HEALTH_CHECK_GROUP = 'inceptum:health';

export function RegisterAsHealthCheck(target: any) {
  RegisterInGroup(HEALTH_CHECK_GROUP)(target);
  Lazy(false)(target);
}

export enum HealthCheckStatus {
  OK = 'OK',
  NOT_READY = 'NOT_READY', // Used when plugin is starting.
  WARNING = 'WARNING', // Used when plugin is stopping.
  CRITICAL = 'CRITICAL', // Used when issues are found after ready.
  STOPPING = 'STOPPING', // Used when the app is stopping - everything is ok, but no new requests should be sent
}

export enum HealthCheckType {
  CONTEXT,
  DEPENDENCY,
  GROUP,
}

function getStatusIndex(status: HealthCheckStatus) {
  return [HealthCheckStatus.OK, HealthCheckStatus.NOT_READY, HealthCheckStatus.WARNING, HealthCheckStatus.CRITICAL, HealthCheckStatus.STOPPING].indexOf(status);
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
  checkRunning = false;

  constructor(public checkName: string, public sleepMillis = 60000, public staleNumFails = 2, private runImmediately = false) {}
  abstract getType(): HealthCheckType;
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
    if (this.runImmediately) {
      this.runCheck();
    }
  }
  async runCheck() {
    if (!this.checkRunning) {
      this.checkRunning = true;
      try {
        this.lastResult = await this.doCheck();
      } catch (e) {
        this.lastResult = new HealthCheckResult(HealthCheckStatus.CRITICAL, `There was an error running check ${this.getCheckName()}: ${e.message}`);
      }
      if (this.lastResult.status === HealthCheckStatus.CRITICAL) {
        LOGGER.error(`Health check ${this.getCheckName()} failed with status CRITICAL`,
          { status: this.lastResult.status, message: this.lastResult.message, data: this.lastResult.data },
        );
      }
      this.checkRunning = false;
    }
  }
  doStart() {
    this.timer = setInterval(async () => { await this.runCheck(); }, this.getSleepMillis());
  }
  stop() {
    if (this.started) {
      this.doStop();
    }
  }
  doStop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
  isStarted(): boolean {
    return this.started;
  }
  abstract async doCheck(): Promise<HealthCheckResult>;
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
  healthChecks = new Map<string,HealthCheck>();
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
      const firstPart = parts[0];
      const remainderPart = asName.substr(firstPart.length + 1);
      const group = this.healthChecks.get(firstPart);
      if (group && (group instanceof HealthCheckGroup)) {
        group.addCheckAs(healthCheck, remainderPart);
      } else if (group) {
        throw new Error(`A health check with name ${firstPart} is already defined in this group`);
      } else {
        const newGroup = new HealthCheckGroup(firstPart);
        newGroup.addCheckAs(healthCheck, remainderPart);
        this.addCheck(newGroup, firstPart);
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
  public async doCheck(): Promise<HealthCheckResult> {
    throw new Error('This shouldn\'t be called. We override getLastResult to get up-to-date info');
  }
  getLastResult(): HealthCheckResult {
    const resp = new HealthCheckResult(HealthCheckStatus.OK, 'OK', new Date().getTime(), {});
    this.healthChecks.forEach((healthCheck, key) => {
      // all health check results are included in response.
      const lastResult = healthCheck.getLastResult();
      resp.data[key] = lastResult;

      // although health status is ignore in /health, notify newrelic.
      if (this.ignoreHealthCheckStatus(healthCheck, lastResult.status)) {
        NewrelicUtil.noticeError(new Error(lastResult.message), lastResult);
      } else {
        if (getStatusIndex(lastResult.status) > getStatusIndex(resp.status)) {
          resp.status = lastResult.status;
          resp.message = `Check ${healthCheck.getCheckName()} returned ${resp.status}`;
        }
      }
    });
    return resp;
  }

  /**
   * Ignore dependencies CRITICAL status. It is not considered
   * to be part of App's health.
   */
  protected ignoreHealthCheckStatus(hc: HealthCheck, status: HealthCheckStatus) {
    return status === HealthCheckStatus.CRITICAL && hc.getType() === HealthCheckType.DEPENDENCY;
  }

  getType(): HealthCheckType {
    return HealthCheckType.GROUP;
  }
}
