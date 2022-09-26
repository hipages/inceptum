import { must } from 'must';
import * as sinon from 'sinon';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';
import * as MockUtil from '../../src/util/TestUtil';
import { Context } from '../../src/ioc/Context';
import { PromiseUtil } from '../../src/util/PromiseUtil';

@suite
class PromiseUtilTest {

  @test
  async testSleepPromise() {
    const start = new Date().getTime();
    const timeoutValue = 1000;
    await PromiseUtil.sleepPromise(timeoutValue);
    const end = new Date().getTime();
    const elapsed = end - start;
    elapsed.must.be.gte(timeoutValue);
  }
}
