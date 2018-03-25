import { suite, test, timeout } from 'mocha-typescript';
import * as must from 'must';
import { register, Histogram } from 'prom-client';
import { Factory} from 'generic-pool';
import { mock, when, instance, verify, deepEqual, anything } from 'ts-mockito';
import { InstrumentedFactory, InstrumentedConnectionPool, DEFAULT_CONNECTION_POOL_OPTIONS, PoolConfig, ConnectionConfig } from '../../src/db/ConnectionPool';

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
  poolStarted;

  before() {
    this.factoryClassMock = mock<Factory<any>>(MockableFactory);
    this.factoryMockInstance = instance<Factory<any>>(this.factoryClassMock);
    register.resetMetrics();
    this.poolStarted = false;
    this.poolConfig = new TestPoolConfig();
    this.instrumentedConnectionPool = new InstrumentedConnectionPool<any, TestConnectionConfig>(this.factoryMockInstance, this.poolConfig, 'TestConnectionPool', false);
  }

  async startPool() {
    await this.instrumentedConnectionPool.start();
    this.poolStarted = true;
  }

  async stopPool() {
    await this.instrumentedConnectionPool.stop();
    this.poolStarted = false;
  }

  async after() {
    if (this.poolStarted) {
      await this.instrumentedConnectionPool.stop();
    }
  }

  @test
  public async 'Default options are used when not specified'() {
    const options = this.instrumentedConnectionPool.getOptions();
    options.max.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.max);
    options.min.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.min);
    options.maxWaitingClients.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.maxWaitingClients);
    options.testOnBorrow.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.testOnBorrow);
    options.acquireTimeoutMillis.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.acquireTimeoutMillis);
    options.evictionRunIntervalMillis.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.evictionRunIntervalMillis);
    options.numTestsPerRun.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.numTestsPerRun);
    must(options.softIdleTimeoutMillis).be.undefined();
    options.idleTimeoutMillis.must.be.equal(DEFAULT_CONNECTION_POOL_OPTIONS.idleTimeoutMillis);
    must(options.connectionConfig).be.undefined();
  }

  @test
  public async 'Getting a connection before starting the pool throws an error'() {
    try {
      const options = await this.instrumentedConnectionPool.getConnection();
      true.must.be.false();
    } catch (e) {
      e.must.be.an.error(`Can't acquire connections from connection pool ${this.instrumentedConnectionPool.getName()}. The pool is not started`);
    }
  }

  @test
  public async 'Starting and stopping the pool'() {
    await this.startPool();
    await this.stopPool();
  }

  @test
  public async 'Can\'t start a pool twice'() {
    await this.startPool();
    try {
      await this.instrumentedConnectionPool.start();
      true.must.be.false();
    } catch (e) {
      e.must.be.an.error('Can\'t start a connection pool that isn\'t in NOT_STARTED state. Pool: TestConnectionPool, Current Status: 1');
    }
  }

  @test
  public async 'Starting the pool calls the factory to fill the pool'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve({id: 1}), Promise.resolve({id: 2}), Promise.resolve({id: 3}));
    await this.startPool();
    verify(this.factoryClassMock.create()).twice();
  }

  @test
  public async 'Stopping the pool destroys the connections'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve({id: 1}), Promise.resolve({id: 2}), Promise.resolve({id: 3}));
    await this.startPool();
    verify(this.factoryClassMock.create()).twice();
    await this.stopPool();
    verify(this.factoryClassMock.destroy(anything())).twice();
  }

  @test
  public async 'Can get resources from the pool'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve({id: 1}), Promise.resolve({id: 2}), Promise.resolve({id: 3}));
    await this.startPool();
    verify(this.factoryClassMock.create()).twice();
    const conn = await this.instrumentedConnectionPool.getConnection();
    conn.id.must.not.be.undefined();
    (conn.id === 1 || conn.id === 2).must.be.true();
    this.instrumentedConnectionPool.release(conn);
  }

  @test
  public async 'Can get multiple resources from the pool'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve({id: 1}), Promise.resolve({id: 2}), Promise.resolve({id: 3}));
    await this.startPool();
    verify(this.factoryClassMock.create()).twice();
    const conn1 = await this.instrumentedConnectionPool.getConnection();
    conn1.id.must.not.be.undefined();
    (conn1.id === 1 || conn1.id === 2).must.be.true();
    const conn2 = await this.instrumentedConnectionPool.getConnection();
    conn2.id.must.not.be.undefined();
    (conn2.id === 1 || conn2.id === 2).must.be.true();
    conn1.id.must.not.equal(conn2.id);
    this.instrumentedConnectionPool.release(conn1);
    this.instrumentedConnectionPool.release(conn2);
  }

  @test
  public async 'After releasing a resource it can be reacquired'() {
    when(this.factoryClassMock.create()).thenReturn(Promise.resolve({id: 1}), Promise.resolve({id: 2}), Promise.resolve({id: 3}));
    await this.startPool();
    verify(this.factoryClassMock.create()).twice();
    const conn = await this.instrumentedConnectionPool.getConnection();
    this.instrumentedConnectionPool.release(conn);
    const conn1 = await this.instrumentedConnectionPool.getConnection();
    conn1.id.must.not.be.undefined();
    (conn1.id === 1 || conn1.id === 2).must.be.true();
    const conn2 = await this.instrumentedConnectionPool.getConnection();
    conn2.id.must.not.be.undefined();
    (conn2.id === 1 || conn2.id === 2).must.be.true();
    conn1.id.must.not.equal(conn2.id);
    this.instrumentedConnectionPool.release(conn1);
    this.instrumentedConnectionPool.release(conn2);
  }


}
