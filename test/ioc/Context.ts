// Test...
import { suite, test, slow, timeout } from 'mocha-typescript';

const { Context } = require('../../src/ioc/Context');
import { Lifecycle, LifecycleState } from '../../src/ioc/Lifecycle';
const { BaseSingletonDefinition } = require('../../src/ioc/objectdefinition/BaseSingletonDefinition');
const { PromiseUtil } = require('../../src/util/PromiseUtil');
const demand = require('must');
import { LogManager } from '../../src/log/LogManager';
const logger = LogManager.getLogger();

class A {
  private val;
  constructor(val) {
    // console.log('Instantiating A');
    this.val = val;
  }
}

class B {
  private a;
  constructor(a) {
    // console.log('Instantiating B');
    this.a = a;
  }
  shutdown() {
    // console.log('Shutting down instance of B');
  }
  delayedStart() {
    logger.info('Starting delayed start');
    return new Promise((resolve) => {
      setTimeout(() => { logger.info('Delaya done'); resolve(); }, 100);
    });
  }
}

class TrackSingleton {
  private static initialised;

  static clear() {
    TrackSingleton.initialised = false;
  }
  static mark() {
    TrackSingleton.initialised = true;
  }
  static isInitialised() {
    return TrackSingleton.initialised;
  }
  constructor() {
    TrackSingleton.mark();
  }
}
TrackSingleton.clear();

class ThrowOnInstantiate {
  constructor() {
    throw new Error('Exception instantiating');
  }
}

suite('ioc/Context', () => {
  suite('inheritance', () => {
    test('starting the child context starts the parent context', () => {
      const parentContext = new Context('parent context');
      const childContext = new Context('child context', parentContext);
      return childContext.lcStart()
        .then(() => {
          childContext.getStatus().must.be.equal(LifecycleState.STARTED);
          parentContext.getStatus().must.be.equal(LifecycleState.STARTED);
        })
        .then(() => childContext.lcStop());
    });
    test('stopping the child context stops the parent context', () => {
      const parentContext = new Context('parent context');
      const childContext = new Context('child context', parentContext);
      return childContext.lcStart()
        .then(() => childContext.lcStop())
        .then(() => {
          childContext.getStatus().must.be.equal(LifecycleState.STOPPED);
          parentContext.getStatus().must.be.equal(LifecycleState.STOPPED);
        });
    });
    test('Parent objects are available in the child context', () => {
      const parentContext = new Context('parent context');
      parentContext.registerSingletons(A);
      const childContext = new Context('child context', parentContext);
      return childContext.lcStart()
        .then(() => childContext.getObjectByName('A'))
        .then((a) => {
          demand(a).is.not.falsy();
          a.must.be.instanceOf(A);
        })
        .then(() => childContext.lcStop());
    });
  });
  suite('Lazyness', () => {
    test('lazy objects are not initialised during context start', () => {
      TrackSingleton.clear();
      const myContext = new Context('test1');
      myContext.registerSingletons(TrackSingleton);
      return myContext.lcStart()
        .then(() => {
          TrackSingleton.isInitialised().must.be.false();
        })
        .then(() => myContext.lcStop());
    });
    test('non-lazy objects are initialised during context start', () => {
      TrackSingleton.clear();
      const myContext = new Context('test1');
      myContext.registerSingletons(TrackSingleton);
      myContext.getDefinitionByName('TrackSingleton').withLazyLoading(false);
      return myContext.lcStart()
        .then(() => {
          TrackSingleton.isInitialised().must.be.true();
        })
        .then(() => myContext.lcStop());
    });
    test('an exception during the initialisation of a non-lazy object cancels the context initialisation', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(ThrowOnInstantiate);
      myContext.getDefinitionByName('ThrowOnInstantiate').withLazyLoading(false);
      return myContext.lcStart()
        .then(() => {
          demand(true).be.false();
        })
        .catch((e) => {
          e.must.be.an.error('Exception instantiating');
        });
    });
  });
  suite('register singleton validations', () => {
    test('can\'t register an object definition that is not one', () => {
      const myContext = new Context('test1');
      try {
        myContext.registerDefinition('not an object definition');
        demand(true).be.false();
      } catch (e) {
        e.must.be.an.error('Provided input for registration is not an instance of ObjectDefinition');
      }
    });
    test('can\'t register an object definition if one by the same name already exists', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      try {
        myContext.registerSingletons(A);
        demand(true).be.false();
      } catch (e) {
        e.must.be.an.error('Object definition with name A already exists in this context');
      }
    });
  });
  suite('individual bean options', () => {
    test('can get a bean', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('A'))
        .then((obj) => {
          obj.must.not.be.undefined();
        })
        .then(() => myContext.lcStop());
    });
    test('can get a bean by type', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectByType('A'))
        .then((obj) => {
          obj.must.not.be.undefined();
        })
        .then(() => myContext.lcStop());
    });
    test('can get a bean by type multi', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectsByType('A'))
        .then((obj) => {
          obj.must.be.array();
          obj.length.must.be.equal(1);
        })
        .then(() => myContext.lcStop());
    });
    test('the bean is a singleton', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectByType('A'))
        .then((obj) => {
          obj.val = 15;
        })
        .then(() => myContext.getObjectByType('A'))
        .then((obj) => {
          obj.val.must.be.equal(15);
        })
        .then(() => myContext.lcStop());
    });
  });
  suite('object with constructor args', () => {
    test('can use value constructor arguments', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('A'))
        .then((a) => {
          a.must.not.be.undefined();
          (a.val).must.be.equal('the value');
        })
        .then(() => myContext.lcStop());
    });
    test('can use reference constructor arguments', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).constructorParamByRef('A'));
      return myContext.lcStart()
        .then(() => PromiseUtil.mapSeries(['A', 'B'], (l) => myContext.getObjectByName(l)))
        .spread((a, b) => {
          a.must.not.be.undefined();
          b.must.not.be.undefined();
          b.a.must.be.equal(a);
        })
        .then(() => myContext.lcStop());
    });
    test('can use type constructor arguments', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).constructorParamByType('A'));
      return myContext.lcStart()
        .then(() => PromiseUtil.mapSeries(['A', 'B'], (l) => myContext.getObjectByName(l)))
        .then((arr) => {
          const a = arr[0];
          const b = arr[1];
          a.must.not.be.undefined();
          b.must.not.be.undefined();
          b.a.must.be.equal(a);
        })
        .then(() => myContext.lcStop());
    });
  });
  suite('getting objects', () => {
    test('getting by name', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('A'))
        .then((a) => {
          demand(a).is.not.undefined();
          a.must.be.an.instanceOf(A);
        })
        .then(() => myContext.lcStop());
    });
    test('getting by type', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectByType('A'))
        .then((a) => {
          demand(a).is.not.undefined();
          a.must.be.an.instanceOf(A);
        })
        .then(() => myContext.lcStop());
    });
    test('getting by type array', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      return myContext.lcStart()
        .then(() => myContext.getObjectsByType('A'))
        .then((a) => {
          demand(a).is.not.undefined();
          a.must.be.an.array();
          a.length.must.be.equal(1);
          a[0].must.be.an.instanceOf(A);
        })
        .then(() => myContext.lcStop());
    });
  });
  suite('getting object definitions', () => {
    test('getting by name', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      const a = myContext.getDefinitionByName('A');
      demand(a).is.not.undefined();
      a.must.be.an.instanceOf(BaseSingletonDefinition);
    });
    test('getting by type', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      const a = myContext.getDefinitionByType('A');
      demand(a).is.not.undefined();
      a.must.be.an.instanceOf(BaseSingletonDefinition);
    });
    test('getting by type array', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(A);
      myContext.registerSingletons(new BaseSingletonDefinition(A, 'A2'));
      const a = myContext.getDefinitionsByType('A');
      demand(a).is.not.undefined();
      a.must.be.an.array();
      a.length.must.equal(2);
      a[0].must.be.an.instanceOf(BaseSingletonDefinition);
      a[0].getProducedClass().must.equal(A);
      demand(a[0].getName() === 'A' || a[0].getName() === 'A2').is.true();
      a[1].must.be.an.instanceOf(BaseSingletonDefinition);
      a[1].getProducedClass().must.equal(A);
      demand(a[1].getName() === 'A' || a[1].getName() === 'A2').is.true();
    });
  });
  suite('objects with parameters set', () => {
    test('can use value params', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).setPropertyByValue('val', 'the value'));
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('A'))
        .then((a) => {
          a.must.not.be.undefined();
          a.val.must.be.equal('the value');
        })
        .then(() => myContext.lcStop());
    });
    test('can use reference params', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).setPropertyByRef('a', 'A'));
      return myContext.lcStart()
        .then(() => PromiseUtil.mapSeries(['A', 'B'], (n) => myContext.getObjectByName(n)))
        .spread((a, b) => {
          a.must.not.be.undefined();
          b.must.not.be.undefined();
          b.a.must.be.equal(a);
        })
        .then(() => myContext.lcStop());
    });
    test('can use type params', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).setPropertyByType('a', 'A'));
      return myContext.lcStart()
        .then(() => PromiseUtil.mapSeries(['A', 'B'], (n) => myContext.getObjectByName(n)))
        .spread((a, b) => {
          a.must.not.be.undefined();
          b.must.not.be.undefined();
          b.a.must.be.equal(a);
        })
        .then(() => myContext.lcStop());
    });
  });
  suite('wiring', () => {
    test('can manage circular dependencies', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByRef('B'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).setPropertyByRef('a', 'A'));
      return myContext.lcStart()
        .then(() => PromiseUtil.mapSeries(['A', 'B'], (n) => myContext.getObjectByName(n)))
        .spread((a, b) => {
          a.must.not.be.undefined();
          b.must.not.be.undefined();
          b.a.must.be.equal(a);
          a.val.must.be.equal(b);
        })
        .then(() => myContext.lcStop());
    });
    test('can manage diamond dependencies', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(B).startFunction('delayedStart'));
      myContext.registerSingletons(new BaseSingletonDefinition(A, 'A1').setPropertyByValue().setPropertyByRef('b', 'B'));
      myContext.registerSingletons(new BaseSingletonDefinition(A, 'A2').setPropertyByRef('b', 'B'));
      myContext.registerSingletons(new BaseSingletonDefinition(A, 'Final').setPropertyByRef('a1', 'A1').setPropertyByRef('a2', 'A2'));
      return myContext.lcStart()
        .then(() => myContext.getObjectByName('Final'))
        .then((final) => {
          demand(final).is.not.undefined();
          demand(final.a1).is.not.undefined();
          demand(final.a2).is.not.undefined();
          demand(final.a1.b).is.not.undefined();
          demand(final.a2.b).is.not.undefined();
          final.a1.b.must.be.equal(final.a2.b);
        })
        .then(() => myContext.lcStop(), (err) => {
          myContext.lcStop();
          throw err;
        });
    });
    test('throws an exception when the circular dependency is in the constructor', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByRef('B'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).constructorParamByRef('A'));

      return myContext.lcStart()
        .then(() => myContext.getObjectByName('A'))
        .then(() => {
          throw new Error('Shouldn\'t be here');
        })
        .catch((err) => {
          err.must.be.an.error(/Circular dependency detected/);
        })
        .then(() => myContext.lcStop());
    });
  });
  suite('cloning', () => {
    test('throws an exception when in any state other than NOT_STARTED', () => {
      const myContext = new Context('test1');
      return myContext.lcStart()
        .then(() => myContext.clone())
        .catch((err) => err.must.be.an.error(/Operation requires state to be/))
        .then(() => myContext.lcStop());
    });
    test('clones all object definitions', () => {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));

      const clonedContext = myContext.clone('test2');

      return myContext.lcStart()
        .then(() => clonedContext.lcStart())
        .then(() => PromiseUtil.mapSeries([myContext, clonedContext], (c) => c.getObjectByName('A')))
        .spread((a, copyA) => {
          a.must.not.be.undefined();
          copyA.must.not.be.undefined();
          copyA.must.be.an.instanceOf(A);
          a.val.must.be.equal(copyA.val);
        })
        .then(() => Promise.all([myContext.lcStop(), clonedContext.lcStop()]));
    });
  });
  suite('importContext', () => {
    test('throws an exception when in any state other than NOT_STARTED', () => {
      const myContext = new Context('test1');
      const otherContext = new Context('other_context');

      return myContext.lcStart()
        .then(() => myContext.importContext(otherContext))
        .catch((e) => e.must.be.an.error(/Operation requires state to be/))
        .then(() => myContext.lcStop());
    });
    test('copies new object definitions into current context', () => {
      const otherContext = new Context('other_context');
      otherContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));

      const myContext = new Context('test1');
      myContext.importContext(otherContext);

      return myContext.lcStart()
        .then(() => otherContext.lcStart())
        .then(() => myContext.getObjectByName('A'))
        .then((a) => {
          a.must.not.be.undefined();
          a.val.must.be.equal('the value');
        })
        .then(() => myContext.lcStop())
        .then(() => otherContext.lcStop());
    });
    test('overwrites an object definition in the current context', () => {
      const otherContext = new Context('other_context');
      otherContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('X'));

      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('A'));

      myContext.importContext(otherContext, true);

      return myContext.lcStart()
        .then(() => otherContext.lcStart())
        .then(() => myContext.getObjectByName('A'))
        .then((a) => {
          a.must.not.be.undefined();
          a.val.must.be.equal('X');
        })
        .then(() => myContext.lcStop())
        .then(() => otherContext.lcStop());
    });
  });
}
);
