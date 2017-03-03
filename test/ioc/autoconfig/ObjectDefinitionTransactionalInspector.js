const { ObjectDefinitionTransactionalInspector } = require('../../../src/ioc/autoconfig/ObjectDefinitionTransactionalInspector');
const { Context } = require('../../../src/ioc/Context');
const co = require('co');
const demand = require('must');

class TestClass {
  * nonTransactional() {
    return yield co.withSharedContext(function* (context) {
      demand(context.currentTransaction).be.undefined();
    });
  }
  * readonlyMethod() {
    return co.withSharedContext((context) => {
      demand(context.currentTransaction).not.be.undefined();
      context.currentTransaction.isReadonly().must.be.true();
      console.log('hi');
    });
  }
  * readwriteMethod() {
    return yield co.withSharedContext(function* (context) {
      demand(context.currentTransaction).not.be.undefined();
      context.currentTransaction.isReadonly().must.be.false();
      console.log('hi');
    });
  }
}

TestClass.transactional = {
  readonlyMethod: 'readonly',
  readwriteMethod: 'readwrite'
};


describe('ioc/autoconfig/ObjectDefinitionTransactionalInspector', () => {
  describe('transactional wrapping', () => {
    it('non transactional method has no transaction', function* () {
      const inspector = new ObjectDefinitionTransactionalInspector();
      const myContext = new Context('test context');
      myContext.addObjectDefinitionInspector(inspector);
      myContext.registerSingletons(TestClass);

      yield myContext.lcStart();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      yield myTestClassInstance.nonTransactional();
      yield myContext.lcStop();
    });
    xit('readonly method has a readonly transaction', function* () {
      const inspector = new ObjectDefinitionTransactionalInspector();
      const myContext = new Context('test context');
      myContext.addObjectDefinitionInspector(inspector);
      myContext.registerSingletons(TestClass);

      yield myContext.lcStart();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      yield myTestClassInstance.readonlyMethod();
      yield myContext.lcStop();
    });
    xit('readwrite method has a readwrite transaction', function* () {
      const inspector = new ObjectDefinitionTransactionalInspector();
      const myContext = new Context('test context');
      myContext.addObjectDefinitionInspector(inspector);
      myContext.registerSingletons(TestClass);

      yield myContext.lcStart();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      yield myTestClassInstance.readwriteMethod();
      yield myContext.lcStop();
    });
  });
});
