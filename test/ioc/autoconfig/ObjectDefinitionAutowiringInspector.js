const { ObjectDefinitionAutowiringInspector } = require('../../../src/ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { BaseSingletonDefinition } = require('../../../src/ioc/objectdefinition/BaseSingletonDefinition');

class TestClass {
}

TestClass.autowire = {
  constructorArgs: ['A', '~B', '*A', '#Config.value'],
  param2: 'B',
  param3: '*A',
  param4: '~A',
  param5: '#Config.value2'
};

class A {}

const inspector = new ObjectDefinitionAutowiringInspector();
const singletonDefinition = new BaseSingletonDefinition(TestClass);

describe('ObjectDefinitionAutowiringInspector', () => {
  describe('interest', () => {
    it('is not interested in non-singletons', () => {
      inspector.interestedIn(new A()).must.be.false();
    });
    it('is not interested in singletons without autowires', () => {
      inspector.interestedIn(new BaseSingletonDefinition(A)).must.be.false();
    });
    it('is interested in singletons with autowires', () => {
      inspector.interestedIn(singletonDefinition).must.be.true();
    });
  });
  inspector.inspect(singletonDefinition);
  describe('constructor params', () => {
    it('wires all parameters', () => {
      singletonDefinition.constructorArgDefinitions.must.be.an.array();
      singletonDefinition.constructorArgDefinitions.length.must.be.equal(4);
    });
    it('wires by reference', () => {
      singletonDefinition.constructorArgDefinitions[0].type.must.be.equal(BaseSingletonDefinition.ParamTypes.Reference);
      singletonDefinition.constructorArgDefinitions[0].refName.must.be.equal('A');
    });
    it('wires by type', () => {
      singletonDefinition.constructorArgDefinitions[1].type.must.be.equal(BaseSingletonDefinition.ParamTypes.Type);
      singletonDefinition.constructorArgDefinitions[1].className.must.be.equal('B');
    });
    it('wires by type array', () => {
      singletonDefinition.constructorArgDefinitions[2].type.must.be.equal(BaseSingletonDefinition.ParamTypes.TypeArray);
      singletonDefinition.constructorArgDefinitions[2].className.must.be.equal('A');
    });
    it('wires by type config', () => {
      singletonDefinition.constructorArgDefinitions[3].type.must.be.equal(BaseSingletonDefinition.ParamTypes.Config);
      singletonDefinition.constructorArgDefinitions[3].key.must.be.equal('Config.value');
    });
  });
  describe('property injections', () => {
    it('wires all properties', () => {
      singletonDefinition.propertiesToSetDefinitions.must.be.an.array();
      singletonDefinition.propertiesToSetDefinitions.length.must.be.equal(4);
    });
    it('wires by reference', () => {
      singletonDefinition.propertiesToSetDefinitions[0].paramName.must.be.equal('param2');
      singletonDefinition.propertiesToSetDefinitions[0].args[0].type.must.be.equal(BaseSingletonDefinition.ParamTypes.Reference);
      singletonDefinition.propertiesToSetDefinitions[0].args[0].refName.must.be.equal('B');
    });
    it('wires by type array', () => {
      singletonDefinition.propertiesToSetDefinitions[1].paramName.must.be.equal('param3');
      singletonDefinition.propertiesToSetDefinitions[1].args[0].type.must.be.equal(BaseSingletonDefinition.ParamTypes.TypeArray);
      singletonDefinition.propertiesToSetDefinitions[1].args[0].className.must.be.equal('A');
    });
    it('wires by type', () => {
      singletonDefinition.propertiesToSetDefinitions[2].paramName.must.be.equal('param4');
      singletonDefinition.propertiesToSetDefinitions[2].args[0].type.must.be.equal(BaseSingletonDefinition.ParamTypes.Type);
      singletonDefinition.propertiesToSetDefinitions[2].args[0].className.must.be.equal('A');
    });
    it('wires by config', () => {
      singletonDefinition.propertiesToSetDefinitions[3].paramName.must.be.equal('param5');
      singletonDefinition.propertiesToSetDefinitions[3].args[0].type.must.be.equal(BaseSingletonDefinition.ParamTypes.Config);
      singletonDefinition.propertiesToSetDefinitions[3].args[0].key.must.be.equal('Config.value2');
    });
  });
});
