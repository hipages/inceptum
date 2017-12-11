import { must } from 'must';
import 'reflect-metadata';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';

import { Autowire, Lazy } from '../../src/ioc/Decorators';

@Lazy(false)
class Test1 {
  @Autowire('the value')
  prop1: string;

  constructor() {
    // console.log('instantiating');
  }
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
});
