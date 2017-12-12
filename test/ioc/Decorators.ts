import { ObjectDefinitionDecoratorInspector } from '../../src/ioc/autoconfig/ObjectDefinitionDecoratorInspector';
import { must } from 'must';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';
import 'reflect-metadata';
import { Context } from '../../src/ioc/Context';

import { Autowire, Lazy, AutowireGroup, RegisterInGroup } from '../../src/ioc/Decorators';
import { BaseSingletonDefinition } from '../../src/ioc/objectdefinition/BaseSingletonDefinition';

@Lazy(false)
class Test1 {
  @Autowire('the value')
  prop1: string;

  constructor() {
    // console.log('instantiating');
  }
}

@RegisterInGroup('g1')
class Wired1 {}

@RegisterInGroup('g1')
class Wired2 {}

@RegisterInGroup('g2')
class Wired3 {}

class WireInto {
  @AutowireGroup('g1')
  prop1: any[];

  @AutowireGroup('g2')
  prop2: any[];

  @AutowireGroup('g3')
  prop3: any[];
}

suite('ioc/Decorators', () => {
  suite('Autowire', () => {
    test('Autowire gets called', () => {
      // const val = new Test1();
      Reflect.hasMetadata('inceptum', Test1.prototype).must.be.true();
      const metadata = Reflect.getMetadata('inceptum', Test1.prototype);
      metadata.autowire.get('prop1').must.equal('the value');
    });
  });
  suite('Lazy', () => {
    test('Lazy gets called', () => {
      // const val = new Test1();
      Reflect.hasMetadata('inceptum', Test1.prototype).must.be.true();
      const metadata = Reflect.getMetadata('inceptum', Test1.prototype);
      metadata.lazy.must.be.false();
    });
  });
  suite('Groups', () => {
    test('Groups are Autowired', async () => {
      const context = new Context('test1');
      context.addObjectDefinitionInspector(new ObjectDefinitionDecoratorInspector());
      context.registerDefinition(new BaseSingletonDefinition(Wired1));
      context.registerDefinition(new BaseSingletonDefinition(Wired2));
      context.registerDefinition(new BaseSingletonDefinition(Wired3));
      context.registerDefinition(new BaseSingletonDefinition(WireInto));
      await context.lcStart();
      const wireInto: WireInto = await context.getObjectByName('WireInto');
      wireInto.prop1.length.must.equal(2);
      (wireInto.prop1[0] instanceof Wired1).must.be.true();
      (wireInto.prop1[1] instanceof Wired2).must.be.true();
      wireInto.prop2.length.must.equal(1);
      (wireInto.prop2[0] instanceof Wired3).must.be.true();
      wireInto.prop3.length.must.equal(0);
      await context.lcStop();
    });
  });
});
