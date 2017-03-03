const { ObjectDefinitionTransactionalInspector } = require('../../../src/ioc/autoconfig/ObjectDefinitionTransactionalInspector');
const { Context } = require('../../../src/ioc/Context');
const co = require('co');
const demand = require('must');

class TestClass {
  * nonTransactional() {
    return co.withSharedContext(function* (context) {
      demand(context.currentTransaction).be.undefined();
    });
  }
  * readonlyMethod() {
    return co.withSharedContext((context) => {
      demand(context.currentTransaction).not.be.undefined();
      context.currentTransaction.isReadonly().must.be.true();
    });
  }
  * readwriteMethod() {
    return co.withSharedContext(function* (context) {
      demand(context.currentTransaction).not.be.undefined();
      context.currentTransaction.isReadonly().must.be.false();
    });
  }
}

TestClass.transactional = {
  readonlyMethod: 'readonly',
  readwriteMethod: 'readwrite'
};


function* createBasicContext() {
  const inspector = new ObjectDefinitionTransactionalInspector();
  const myContext = new Context('test context');
  myContext.addObjectDefinitionInspector(inspector);
  myContext.registerSingletons(TestClass);

  yield myContext.lcStart();
  return myContext;
}

function* disposeContext(myContext) {
  yield myContext.lcStop();
}

describe('ioc/autoconfig/ObjectDefinitionTransactionalInspector', () => {
  describe('transactional wrapping', () => {
    it('non transactional method has no transaction', function* () {
      const myContext = yield createBasicContext();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      yield myTestClassInstance.nonTransactional();
      yield disposeContext(myContext);
    });
    it('readonly method has a readonly transaction', function* () {
      const myContext = yield createBasicContext();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      yield myTestClassInstance.readonlyMethod();
      yield disposeContext(myContext);
    });
    it('readwrite method has a readwrite transaction', function* () {
      const myContext = yield createBasicContext();
      const myTestClassInstance = yield* myContext.getObjectByName('TestClass');
      yield myTestClassInstance.readwriteMethod();
      yield disposeContext(myContext);
    });
  });
});
