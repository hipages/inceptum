import * as mocha from 'mocha';
import { must } from 'must';

import BaseApp from '../../src/app/BaseApp';
import { LifecycleState } from '../../src/ioc/Lifecycle';
describe('BaseApp - Plugins', () => {
  it('must be able to register plugins', () => {
    class TestPlugin {
      name: 'foo';
      didStart() {  // tslint:disable-line
        return null;
      }
    }
    const App = new BaseApp();
    App.register(new TestPlugin());
  });

  it('must be able to register multiple plugins', async () => {
    let count = 0;
    class TestPlugin1 {
      name = 'foo';
      willStart() { // tslint:disable-line
        count++;
      }
    }
    class TestPlugin2 {
      name = 'bar';
      willStart() { // tslint:disable-line
        count++;
      }
    }
    const App = new BaseApp();
    App.register(new TestPlugin1(), new TestPlugin2());
    await App.start();
    count.must.equal(2);
  });

  it('must not allow you to register a plugin after the app is started', async () => {
    class TestPlugin {
      name = 'foo';
      willStart:() => null;
    }
    const App = new BaseApp();
    await App.start();
    try {
      App.register(new TestPlugin());
    } catch (e) {
      e.must.be.an.error();
    }
  });

  it('it must call preStart before the app starts', async done => {
    const App = new BaseApp();
    class TestPlugin {
      public name = 'TestPlugin2';
      willStart() { // tslint:disable-line
        App.getContext().assertState(LifecycleState.NOT_STARTED);
        done();
      }
    }
    App.register(new TestPlugin());
    App.start();
  });

  it('it must call didStart after the app starts', async done => {
    const App = new BaseApp();
    class TestPlugin {
      public name = 'TestPlugin2';
      didStart() { // tslint:disable-line
        App.getContext().assertState(LifecycleState.STARTED);
        done();
      }
    }
    App.register(new TestPlugin());
    App.start();
  });

  it('it must call willStop before the app stops', async done => {
    const App = new BaseApp();
    class TestPlugin {
      public name = 'TestPlugin2';
      willStop() { // tslint:disable-line
        App.getContext().assertState(LifecycleState.STARTED);
        done();
      }
    }
    App.register(new TestPlugin());
    await App.start();
    App.stop();
  });

  it('it must call willStop after the app stops', async done => {
    const App = new BaseApp();
    class TestPlugin {
      public name = 'TestPlugin2';
      didStop() { // tslint:disable-line
        App.getContext().assertState(LifecycleState.STOPPED);
        done();
      }
    }
    App.register(new TestPlugin());
    await App.start();
    App.stop();
  });
});
