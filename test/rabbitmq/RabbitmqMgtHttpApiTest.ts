import { suite, test } from 'mocha-typescript';
import { must } from 'must';
import { mock, when, instance, verify } from 'ts-mockito';
import Axios, { AxiosStatic, AxiosPromise } from 'axios';
import * as sinon from 'sinon';
import * as config from 'config';
import { RabbitmqMgtHttpApi } from '../../src/rabbitmq/RabbitmqMgtHttpApi';

@suite
class RabbitmqMgtHttpApiTest {

  protected axiosRequestStub;

  before() {
    this.axiosRequestStub = sinon.stub(Axios, 'request');
  }

  after() {
    this.axiosRequestStub.restore();
  }

  @test
  async 'Return OK'() {
    // const api = new RabbitmqMgtHttpApi();
    const okRes: AxiosPromise = Promise.resolve({
      status: 200,
      data: {
        status: 'ok',
      },
      statusText: 'success',
      headers: {},
      config: {},
    });

    this.axiosRequestStub.returns(okRes);
    const api = new RabbitmqMgtHttpApi();
    api.rabbitmqConfig = config.get('rabbitmq.client');
    const result = await api.ping();
    result.must.be.eql({status: 'ok'});
  }

  @test
  async 'Return status is 200 and a reason'() {
    const okRes: AxiosPromise = Promise.resolve({
      status: 200,
      data: {
        status: 'failed',
        reason: 'memory usage is too high',
      },
      statusText: 'success',
      headers: {},
      config: {},
    });

    this.axiosRequestStub.returns(okRes);
    const api = new RabbitmqMgtHttpApi();
    api.rabbitmqConfig = config.get('rabbitmq.client');
    const result = await api.ping();
    result.must.be.eql({status: 'failed', reason: 'memory usage is too high'});
  }

  @test
  async 'Bad request causes Exception'() {
    const okRes: AxiosPromise = Promise.resolve({
      status: 400,
      data: {},
      statusText: 'Bad Request',
      headers: {},
      config: {},
    });

    this.axiosRequestStub.returns(okRes);
    const api = new RabbitmqMgtHttpApi();
    api.rabbitmqConfig = config.get('rabbitmq.client');
    await api.ping().must.throw();
  }

  @test
  async 'Return Exception'() {
    const okRes: AxiosPromise = Promise.reject('error');

    this.axiosRequestStub.returns(okRes);
    const api = new RabbitmqMgtHttpApi();
    api.rabbitmqConfig = config.get('rabbitmq.client');
    await api.ping().must.throw();
  }
}
