import { suite, test } from 'mocha-typescript';
import { must } from 'must';
import * as sinon from 'sinon';
import { RabbitmqMgtHttpApi, RabbitmqNodeHealthCheckResult } from '../../src/rabbitmq/RabbitmqMgtHttpApi';
import { RabbitmqHealthCheck } from '../../src/rabbitmq/RabbitmqHealthCheck';
import { HealthCheckStatus, HealthCheckResult } from '../../src/health/HealthCheck';

@suite
class RabbitmqHealthCheckTest {

  protected apiPing;

  before() {
    this.apiPing = sinon.createStubInstance(RabbitmqMgtHttpApi);
    this.apiPing.rabbitmqConfig = {};
  }

  @test
  async 'ping ok'() {
    const ok: RabbitmqNodeHealthCheckResult = {
      status: 'ok',
    };
    this.apiPing.ping.returns(ok);
    const hc = new RabbitmqHealthCheck('RabbitmqHealthCheck');
    hc.rabbitmqMgtHttpApi = this.apiPing;
    const result = await hc.doCheck();
    result.must.be.eql(new HealthCheckResult(HealthCheckStatus.OK, 'Ping OK'));

  }

  @test
  async 'ping critical'() {
    const failed: RabbitmqNodeHealthCheckResult = {
      status: 'failed',
      reason: 'here is a reason',
    };
    this.apiPing.ping.returns(failed);
    const hc = new RabbitmqHealthCheck('RabbitmqHealthCheck');
    hc.rabbitmqMgtHttpApi = this.apiPing;
    try {
      const result = await hc.doCheck();
    } catch (e) {
      e.must.be.eql(new HealthCheckResult(HealthCheckStatus.CRITICAL, 'here is a reason'));
    }
  }

  @test
  async 'ping exception'() {
    this.apiPing.ping.throws();
    const hc = new RabbitmqHealthCheck('RabbitmqHealthCheck');
    hc.rabbitmqMgtHttpApi = this.apiPing;
    try {
      const result = await hc.doCheck();
    } catch (e) {
      e.must.be.an.error();
    }
  }

  @test
  async 'ping disabled'() {
    this.apiPing.rabbitmqConfig.healthCheckEnabled = false;
    const hc = new RabbitmqHealthCheck('RabbitmqHealthCheck');
    hc.rabbitmqMgtHttpApi = this.apiPing;
    const result = await hc.doCheck();
    result.must.be.eql(new HealthCheckResult(HealthCheckStatus.OK, 'Health check DISABLED'));
  }
}
