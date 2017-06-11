import { must } from 'must';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';
import * as MockUtil from '../../src/util/TestUtil';
import { Context } from '../../src/ioc/Context';

suite('util/TestUtil', () => {
  suite('Call capture', () => {
    test('one', () => {
      const mock = MockUtil.mock<Context>(Context);
      MockUtil.when(mock.getDefinitionByName).isCalledWith('A').thenReturn('A is the result');
      mock.getDefinitionByName('A').must.equal('A is the result');
    });
  });
});
