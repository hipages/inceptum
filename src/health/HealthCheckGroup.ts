import { HealthCheck, HealthCheckResult } from './HealthCheck';

export default class HealthCheckGroup implements HealthCheck {
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

