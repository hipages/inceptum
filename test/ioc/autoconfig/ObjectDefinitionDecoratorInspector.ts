import { must } from 'must';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';

import { Autowire, Lazy, AutowireConfig } from '../../../src/ioc/Decorators';
import { BaseSingletonDefinition, ParamType } from '../../../src/ioc/objectdefinition/BaseSingletonDefinition';
import { ObjectDefinitionDecoratorInspector } from '../../../src/ioc/autoconfig/ObjectDefinitionDecoratorInspector';

@Lazy(false)
class Test1 {
  @Autowire('theReference')
  prop1: string;

  @AutowireConfig('configKey')
  prop2: string;
}

class Test2 {
}

const inspector = new ObjectDefinitionDecoratorInspector();

suite('ioc/autoconfig/ObjectDefinitionDecoratorInspector', () => {
  suite('interestedIn', () => {
    test('It\'s not interested on non-decorated classes', () => {
      const definition = new BaseSingletonDefinition(Test2);
      inspector.interestedIn(definition).must.be.false();
    });
    test('It\'s interested on decorated classes', () => {
      const definition = new BaseSingletonDefinition(Test1);
      inspector.interestedIn(definition).must.be.true();
    });
  });
  suite('doInspect', () => {
    test('It sets the Lazy flag appropriately', () => {
      const definition = new BaseSingletonDefinition(Test1);
      inspector.doInspect(definition);
      definition.lazyLoading.must.be.false();
    });
    test('It sets autowiring properly', () => {
      const definition = new BaseSingletonDefinition(Test1);
      inspector.doInspect(definition);
      const callDefinitions = definition.getPropertiesToSetDefinitions();
      callDefinitions.length.must.equal(2);
      callDefinitions[0].paramName.must.equal('prop1');
      callDefinitions[0].args.length.must.equal(1);
      callDefinitions[0].args[0].type.must.equal(ParamType.Reference);
      callDefinitions[0].args[0].refName.must.equal('theReference');

      callDefinitions[1].paramName.must.equal('prop2');
      callDefinitions[1].args.length.must.equal(1);
      callDefinitions[1].args[0].type.must.equal(ParamType.Config);
      callDefinitions[1].args[0].key.must.equal('configKey');
    });
  });
});
