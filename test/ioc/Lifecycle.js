// Test...
const { Lifecycle } = require('../../src/ioc/Lifecycle');

class MyLifecycle extends Lifecycle {
  doStart() {
  }

  doPostStart() {
  }

  doStop() {
  }
}

describe('Lifecycle', () => {
  describe('Remains abstract', () => {
    it('Must fail if do* methods are not overriden', function* () {
      const myLifecycle = new Lifecycle('test1');
      try {
        yield myLifecycle.doStart();
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error();
      }
      try {
        yield myLifecycle.doStop();
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error();
      }
      try {
        yield myLifecycle.doPostStart();
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error();
      }
    });
    it('Must work if important methods are overriden', function* () {
      const myLifecycle = new MyLifecycle('name');
      yield myLifecycle.lcStart();
      yield myLifecycle.lcStop();
    });
  });
});
