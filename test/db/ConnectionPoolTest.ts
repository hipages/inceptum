import { suite, test } from 'mocha-typescript';
import { must } from 'must';
import { register, Histogram } from 'prom-client';
import { Factory} from 'generic-pool';
import { mock, when, instance, verify, deepEqual, anything } from 'ts-mockito';
import { InstrumentedFactory, InstrumentedConnectionPool } from '../../src/db/ConnectionPool';
import { PoolConfig, ConnectionConfig } from '../../src/db/DBClient';

/**
 * This class is here just to provide scafolding for ts-mockito to mock
 */
class MockableFactory implements Factory<any> {
  create(): PromiseLike<any> {
    throw new Error('Method not implemented.');
  }
  destroy(client: any): PromiseLike<undefined> {
    throw new Error('Method not implemented.');
  }
  validate(client: any): PromiseLike<boolean> {
    throw new Error('Method not implemented.');
  }
}
class FactoryWithoutValidate implements Factory<any> {
  create(): PromiseLike<any> {
    throw new Error('Method not implemented.');
  }
  destroy(client: any): PromiseLike<undefined> {
    throw new Error('Method not implemented.');
  }
}

@suite('db/ConnectionPool.InstrumentedFactory')
class InstrumentedFactoryTest {
  instrumentedFactory: InstrumentedFactory<any>;
  factoryMockInstance: Factory<any>;
  factoryClassMock: Factory<any>;

  before() {
    this.factoryClassMock = mock<Factory<any>>(MockableFactory);
    this.factoryMockInstance = instance<Factory<any>>(this.factoryClassMock);
    register.resetMetrics();
    this.instrumentedFactory = new InstrumentedFactory<any>(this.factoryMockInstance, 'TestFactory', true);
  }

  @test
  public async 'Create calls create in the underlying factory'() {
    const theConn = {val: 123};
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve(theConn));
    const c = await this.instrumentedFactory.create();
    c.val.must.equal(123);
    verify(this.factoryClassMock.create()).once();
  }

  @test
  public async 'Create is captured in metrics'() {
    const theConn = {val: 123};
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve(theConn));
    const c = await this.instrumentedFactory.create();
    const metric = register.getSingleMetric('db_pool_connect_time_histogram');
    metric['hashMap']['poolName:TestFactory,readonly:true'].count.must.be.equal(1);
  }

  @test
  public async 'Exceptions thrown by underlying factory are passed'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.reject(new Error('connection error')));
    try {
      await this.instrumentedFactory.create();
      true.must.be.false();
    } catch (e) {
      e.must.be.an.error('connection error');
    }
    verify(this.factoryClassMock.create()).once();
  }

  @test
  public async 'Exceptions thrown are captured in metrics'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.reject(new Error('connection error')));
    try {
      await this.instrumentedFactory.create();
    } catch (e) {
      e.must.be.an.error('connection error');
    }
    const metric = register.getSingleMetric('db_pool_connect_errors_counter');
    metric['hashMap']['poolName:TestFactory,readonly:true'].value.must.be.equal(1);
  }

  @test
  public async 'Destroy calls destroy in the underlying factory'() {
    const theConn = {val: 123};
    when(this.factoryClassMock.destroy(deepEqual(theConn))).thenReturn(Promise.resolve(undefined));
    await this.instrumentedFactory.destroy(theConn);
    verify(this.factoryClassMock.destroy(deepEqual(theConn))).once();
  }

  @test
  public async 'Validate calls validate in the underlying factory'() {
    const theConn = {val: 123};
    when(this.factoryClassMock.validate(deepEqual(theConn))).thenReturn(Promise.resolve(true));
    const resp = await this.instrumentedFactory.validate(theConn);
    resp.must.be.true();
    verify(this.factoryClassMock.validate(deepEqual(theConn))).once();
  }

  @test()
  public async 'Validate with an underlying factory that doesn\'t implement it returns true'() {
    this.factoryClassMock = mock<Factory<any>>(FactoryWithoutValidate);
    this.factoryMockInstance = instance<Factory<any>>(this.factoryClassMock);
    this.instrumentedFactory = new InstrumentedFactory<any>(this.factoryMockInstance, 'TestFactory', true);

    this.factoryClassMock.validate.must.not.be.a.function();

    const theConn = {val: 123};
    const resp = await this.instrumentedFactory.validate(theConn);
    resp.must.be.true();
  }
}

class TestConnectionConfig implements ConnectionConfig {
}

class TestPoolConfig implements PoolConfig<TestConnectionConfig> {
  max: number;
  min: number;
  maxWaitingClients: number;
  testOnBorrow?: boolean;
  acquireTimeoutMillis?: number;
  evictionRunIntervalMillis?: number;
  numTestsPerRun?: number;
  softIdleTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  connectionConfig?: TestConnectionConfig;
}

@suite
class InstrumentedConnectionPoolTest {
  instrumentedConnectionPool: InstrumentedConnectionPool<any, TestConnectionConfig>;
  poolConfig: TestPoolConfig;
  factoryMockInstance: Factory<any>;
  factoryClassMock: Factory<any>;

  before() {
    this.factoryClassMock = mock<Factory<any>>(MockableFactory);
    this.factoryMockInstance = instance<Factory<any>>(this.factoryClassMock);
    register.resetMetrics();
    this.poolConfig = new TestPoolConfig();
    this.poolConfig.max = 100;
    this.poolConfig.min = 2;
    this.poolConfig.maxWaitingClients = 23;
    this.instrumentedConnectionPool = new InstrumentedConnectionPool<any, TestConnectionConfig>(this.factoryMockInstance, this.poolConfig, 'TestConnectionPool', false);
  }

  @test
  public async 'Default options are used when not specified'() {
    const options = this.instrumentedConnectionPool.getOptions();
    options.testOnBorrow.must.be.false();
  }
}
