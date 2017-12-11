import { must } from 'must';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';
import { PromiseUtil } from '../../../src/util/PromiseUtil';

import * as MockUtil from '../../../src/util/TestUtil';
import { Context } from '../../../src/ioc/Context';
import { BaseSingletonDefinition, BaseSingletonDefinitionTestUtil } from '../../../src/ioc/objectdefinition/BaseSingletonDefinition';
import { LogManager } from '../../../src/log/LogManager';
const logger = LogManager.getLogger();

class A {
  public val;
  public b: B;
  constructor(val) {
    // console.log('Instantiating A');
    this.val = val;
  }
}

class B {
  public val: any;
  // tslint:disable-next-line:prefer-function-over-method
  delayedStart(): Promise<any> {
    const self = this;
    return PromiseUtil.sleepPromise<any>(50)
    .then(() => { self.val = 'After delayed start'; });
  }
}

suite('ioc/objectdefinition/BaseSingletonDefinition', () => {
  suite('getAllConstructorObjectDefinitions', () => {
    test('No dependencies gives back an empty array', () => {
      const def = new BaseSingletonDefinitionTestUtil(A);
      const deps = def.exposeGetAllConstructorObjectDefinitions();
      deps.must.be.an.array();
      deps.length.must.equal(0);
    });
    test('Value dependencies gives back an empty array', () => {
      const def = new BaseSingletonDefinitionTestUtil(A);
      def.constructorParamByValue(5);
      const deps = def.exposeGetAllConstructorObjectDefinitions();
      deps.must.be.an.array();
      deps.length.must.equal(0);
    });
    test('Config dependencies gives back an empty array', () => {
      const def = new BaseSingletonDefinitionTestUtil(A);
      def.constructorParamByConfig('app.name');
      const deps = def.exposeGetAllConstructorObjectDefinitions();
      deps.must.be.an.array();
      deps.length.must.equal(0);
    });
    test('Ref dependency gives back a non empty array', () => {
      const context = new Context('Test');
      context.registerDefinition(new BaseSingletonDefinition<B>(B));
      const def = new BaseSingletonDefinitionTestUtil(A);
      def.constructorParamByRef('B');
      context.registerDefinition(def);
      const deps = def.exposeGetAllConstructorObjectDefinitions();
      deps.must.be.an.array();
      deps.length.must.equal(1);
      deps[0].getName().must.equal('B');
    });
  });
  suite('checkConstructorCircularDependency', () => {
    test('No dependencies means no circular dependency', () => {
      const def = new BaseSingletonDefinition<A>(A);
      def.checkConstructorCircularDependency();
    });
    test('If trace contains me, there\'s a Circular Dependency', () => {
      const def = new BaseSingletonDefinition<A>(A);
      try {
        def.checkConstructorCircularDependency(['hsd', 'A']);
        false.must.be.true();
      } catch (e) {
        e.must.be.an.error(/Circular dependency detected/);
      }
    });
    test('If trace doesn\'t contains me, there\'s no Circular Dependency', () => {
      const def = new BaseSingletonDefinition<A>(A);
      def.checkConstructorCircularDependency(['hsd', 'B']);
    });
  });
  suite('getInstance', () => {
    test('get simple instance', () => {
      const contextMock = MockUtil.mock<Context>(Context);
      // const contextMock = new Object();
      const defA = new BaseSingletonDefinition<A>(A);
      defA.setContext(contextMock);

      const promise = defA.getInstance()
      .then((instance) => {
        instance.must.not.be.falsy();
      });
      return promise;
    });
    test('get instance with constructor dep', () => {
      const contextMock = MockUtil.mock<Context>(Context);
      // const contextMock = new Object();
      const defA = new BaseSingletonDefinition<A>(A);
      defA.setContext(contextMock);
      defA.constructorParamByRef('B');

      const defB = new BaseSingletonDefinition<B>(B);
      defB.setContext(contextMock);
      MockUtil.when(contextMock.getDefinitionByName).isCalledWith('B').thenReturn(defB);

      const promise = defA.getInstance()
      .then((instance) => {
        instance.must.not.be.falsy();
        instance.val.must.not.be.falsy();
        (instance.val instanceof B).must.be.true();
      });
      return promise;
    });
    test('get instance with parameter by value', () => {
      const contextMock = MockUtil.mock<Context>(Context);
      // const contextMock = new Object();
      const defA = new BaseSingletonDefinition<A>(A);
      defA.setContext(contextMock);
      defA.setPropertyByValue('val', 'The value is important');

      const promise = defA.getInstance()
      .then((instance) => {
        instance.must.not.be.falsy();
        instance.val.must.not.be.falsy();
        instance.val.must.equal('The value is important');
      });
      return promise;
    });
    test('get instance with circular dep in constructor', () => {
      const contextMock = MockUtil.mock<Context>(Context);
      // const contextMock = new Object();
      const defA = new BaseSingletonDefinition<A>(A);
      defA.setContext(contextMock);
      defA.constructorParamByRef('B');
      MockUtil.when(contextMock.getDefinitionByName).isCalledWith('A').thenReturn(defA);

      const defB = new BaseSingletonDefinition<B>(B);
      defB.setContext(contextMock);
      defB.constructorParamByRef('A');
      MockUtil.when(contextMock.getDefinitionByName).isCalledWith('B').thenReturn(defB);

      try {
        defA.checkConstructorCircularDependency();
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error(/Circular dependency detected/);
      }
    });
    test('gets instance fully instantiated if possible', () => {
      const contextMock = MockUtil.mock<Context>(Context);
      const defB = new BaseSingletonDefinition<B>(B);
      defB.setContext(contextMock);
      defB.startFunction('delayedStart');

      return defB.getInstance()
      .then((instance) => {
        (instance === undefined).must.be.false();
        (instance.val === undefined).must.be.false();
        instance.val.must.equal('After delayed start');
      });
    });
  });
});
