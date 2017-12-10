import { must } from 'must';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';
import { LogManagerInternal } from '../../src/log/LogManager';

const beSmartOnThePath = LogManagerInternal['beSmartOnThePath'];

suite('log/LogManager', () => {
  suite('LogManagerInternal', () => {
    test('Be smart on the path properly cuts the path when dist is present', () => {
      beSmartOnThePath('/some/path/with/dist/in/it/File.js').must.equal('in/it/File.js');
    });
  });
});
