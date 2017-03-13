// Test...
const { Lifecycle } = require('../../src/ioc/Lifecycle');

class StartOverriden extends Lifecycle {
  doStart() {
    return Promise.resolve();
  }
}

class AllOverriden extends Lifecycle {
  doStart() {
    return Promise.resolve();
  }

  doStop() {
    return Promise.resolve();
  }
}

describe('ioc/Lifecycle', () => {
  describe('Remains abstract', () => {
    it('Must fail if doStart method is not overriden', () =>
        (new Lifecycle('test1'))
          .lcStart()
          .then(
            () => {
              throw new Error('Shouldn\'t resolve');
            },
            (err) => err.must.be.an.error('Unimplemented')
          )
      // .then(() => { console.log('here'); })
    );
    it('Must fail if doStop method is not overriden',
      () => {
        const obj = new StartOverriden('test2');
        return obj
          .lcStart()
          .catch((err) => {
            throw new Error(`Unexpected exception ${err.message}`);
          })
          .then(() => obj.lcStop())
          .then(
            () => {
              throw new Error('Shouldn\'t resolve');
            },
            (err) => err.must.be.an.error('Unimplemented')
          );
      }
    );
    it('Must succeed if both methods are overriden',
      () => {
        const obj = new AllOverriden('test3');
        return obj
          .lcStart()
          .catch((err) => {
            throw new Error(`Unexpected exception ${err.message}`);
          })
          .then(() => obj.lcStop())
          .catch((err) => {
            throw new Error(`Unexpected exception ${err.message}`);
          });
      }
    );
  });
  describe('Baisc', () => {
    it('Name is saved', () => {
      (new Lifecycle('test1')).getName().must.equal('test1');
    });
    it('Can\'t be started twice',
      () => {
        const obj = new StartOverriden('test2');
        return obj
          .lcStart()
          .catch((err) => {
            throw new Error(`Unexpected exception ${err.message}`);
          })
          .then(() => obj.lcStart())
          .then(
            () => {
              throw new Error('Shouldn\'t resolve');
            },
            (err) => err.must.be.an.error(/^Can't revert on the status chain/)
          );
      }
    );
  });
});
