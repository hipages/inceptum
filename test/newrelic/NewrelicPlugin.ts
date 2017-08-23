import * as mocha from 'mocha';
import { must } from 'must';
import { NewrelicUtil } from '../../src/newrelic/NewrelicUtil';
import NewrelicPlugin from '../../src/newrelic/NewrelicPlugin';

import BaseApp from '../../src/app/BaseApp';
import { LifecycleState } from '../../src/ioc/Lifecycle';

class MyMock {
  params: any[];
  shutdown(params, callback) {
    this.params = params;
    callback();
  }
}

describe('newrelic/NewrelicPlugin', () => {
  it('Plugin must call the shutdown method if newrelic is enabled', async () => {
    const App = new BaseApp();
    const myMock = new MyMock();
    NewrelicUtil.mockUtil_setNewrelic(myMock);
    App.register(new NewrelicPlugin());
    await App.start();
    (myMock.params === undefined).must.be.true();
    await App.stop();
    (myMock.params === undefined).must.be.false();
  });
  it('Plugin must not call the shutdown method if newrelic is disabled', async () => {
    const App = new BaseApp();
    const myMock = new MyMock();
    NewrelicUtil.mockUtil_setNewrelic(null);
    App.register(new NewrelicPlugin());
    await App.start();
    (myMock.params === undefined).must.be.true();
    await App.stop();
    (myMock.params === undefined).must.be.true();
  });
});
