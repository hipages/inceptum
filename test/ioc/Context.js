// Test...
const { Context } = require('../../src/ioc/Context');
const { BaseSingletonDefinition } = require('../../src/ioc/objectdefinition/BaseSingletonDefinition');

class A {
  constructor(val) {
    console.log('Instantiating A');
    this.val = val;
  }
}

class B {
  constructor(a) {
    console.log('Instantiating B');
    // console.log(a);
    this.a = a;
  }
  shutdown() {
    console.log('Shutting down instance of B');
  }
}


describe('Context', () => {
  describe('individual bean options', function* () {
    const myContext = new Context('test1');
    myContext.registerSingletons(A);
    yield myContext.lcStart();
    it('can get a bean', () => {
      myContext.getObjectByName('A').must.not.be.undefined();
    });
    it('can get a bean by type', () => {
      myContext.getObjectByType('A').must.not.be.undefined();
    });
    it('can get a bean by type multi', function* () {
      const beans = yield* myContext.getObjectsByType('A');
      beans.must.be.array();
      beans.length.must.be.equal(1);
    });
    it('the bean is a singleton', function* () {
      const bean = yield* myContext.getObjectByName('A');
      bean.val = 15;
      const bean2 = yield* myContext.getObjectByName('A');
      bean2.val.must.be.equal(15);
    });
    yield myContext.lcStop();
  });
  describe('beans with constructor args', () => {
    it('can use value constructor arguments', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      a.must.not.be.undefined();
      a.val.must.be.equal('the value');
      yield myContext.lcStop();
    });
    it('can use reference constructor arguments', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).constructorParamByRef('A'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      const b = yield* myContext.getObjectByName('B');
      a.must.not.be.undefined();
      b.must.not.be.undefined();
      b.a.must.be.equal(a);
      yield myContext.lcStop();
    });
    it('can use type constructor arguments', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).constructorParamByType('A'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      const b = yield* myContext.getObjectByName('B');
      a.must.not.be.undefined();
      b.must.not.be.undefined();
      b.a.must.be.equal(a);
      yield myContext.lcStop();
    });
  });
  describe('beans with parameters set', () => {
    it('can use value params', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).setPropertyByValue('val', 'the value'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      a.must.not.be.undefined();
      a.val.must.be.equal('the value');
      yield myContext.lcStop();
    });
    it('can use reference params', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).setPropertyByRef('a', 'A'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      const b = yield* myContext.getObjectByName('B');
      a.must.not.be.undefined();
      b.must.not.be.undefined();
      b.a.must.be.equal(a);
      yield myContext.lcStop();
    });
    it('can use type params', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByValue('the value'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).setPropertyByType('a', 'A'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      const b = yield* myContext.getObjectByName('B');
      a.must.not.be.undefined();
      b.must.not.be.undefined();
      b.a.must.be.equal(a);
      yield myContext.lcStop();
    });
  });
  describe('wiring', () => {
    it('can manage circular dependencies', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByRef('B'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).setPropertyByRef('a', 'A'));
      yield myContext.lcStart();
      const a = yield* myContext.getObjectByName('A');
      const b = yield* myContext.getObjectByName('B');
      a.must.not.be.undefined();
      b.must.not.be.undefined();
      b.a.must.be.equal(a);
      a.val.must.be.equal(b);
      yield myContext.lcStop();
    });
    it('throws an exception when the circular dependency is in the constructor', function* () {
      const myContext = new Context('test1');
      myContext.registerSingletons(new BaseSingletonDefinition(A).constructorParamByRef('B'));
      myContext.registerSingletons(new BaseSingletonDefinition(B).constructorParamByRef('A'));
      yield myContext.lcStart();
      try {
        yield* myContext.getObjectByName('A');
        '1'.must.equal('2'); // Fail
      } catch (e) {
        console.log('There was an exception');
        e.must.be.an.error(/Circular dependency detected/);
      } finally {
        yield myContext.lcStop();
      }
    });
  });
}
);

//
// const myContext = new Context('testContext');
//
// myContext
//   .register(new BaseSingletonDefinitionDefinition(A).constructorParamByValue('the value'))
//   .register(new BaseSingletonDefinitionDefinition(B).constructorParamByRef('A').
// shutdownFunction('shutdown'));
//
// try {
//   myContext.lcStart();
//   const b = myContext.getObjectByName('B');
//   console.log(b);
// } catch (e) {
//   console.log(e);
//   console.log(e.stack);
// }
//
// myContext.lcStop();
