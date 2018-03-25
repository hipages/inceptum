import { HealthCheck, HealthCheckResult, HealthCheckStatus, RegisterAsHealthCheck } from '../health/HealthCheck';
import { MySQLClient } from './MySQLClient';

@RegisterAsHealthCheck
export class MySQLHealthCheck extends HealthCheck {

  mysqlClient: MySQLClient;

  constructor(name: string, private readonly: boolean) {
    super(name, 60000, 2, true);
  }

  public async doCheck(): Promise<HealthCheckResult> {
    if (!this.mysqlClient) {
      return new HealthCheckResult(HealthCheckStatus.NOT_READY, 'MySQL Client not set yet');
    }
    try {
      await this.mysqlClient.ping(this.readonly);
      return new HealthCheckResult(HealthCheckStatus.OK, 'Ping OK');
    } catch (e) {
      return new HealthCheckResult(HealthCheckStatus.CRITICAL, `Couldn't ping DB ${this.readonly ? 'slave' : 'master'}: ${e.message}`, new Date().getTime(), e);
    }
  }
}
