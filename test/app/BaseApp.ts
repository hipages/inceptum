import {when, spy, capture, anything, reset} from 'ts-mockito';
import BaseApp from '../../src/app/BaseApp';
import {Context} from '../../src';

describe('BaseApp', () => {
  describe('addDirectory method', () => {
    it('calls findMatchingFiles with default arguments', () => {
      const app = new BaseApp();
      const spiedContext = spy(Context);

      when(spiedContext.findMatchingFiles(anything(), anything())).thenReturn([]);

      app.addDirectory('src/**/*.js');

      const lastCall = capture(spiedContext.findMatchingFiles).last();
      lastCall.must.eql([
        'src/**/*.js',
        {
          isGlob: false,
          globOptions: {},
        },
      ]);

      reset(spiedContext);
    });
    it('calls findMatchingFiles with given arguments', () => {
      const app = new BaseApp();
      const spiedContext = spy(Context);

      when(spiedContext.findMatchingFiles(anything(), anything())).thenReturn([]);

      app.addDirectory('src/**/*.js', {
        isGlob: true,
        globOptions: {
          gitignore: true,
        },
      });

      const lastCall = capture(spiedContext.findMatchingFiles).last();
      lastCall.must.eql([
        'src/**/*.js',
        {
          isGlob: true,
          globOptions: {
            gitignore: true,
          },
        },
      ]);

      reset(spiedContext);
    });
  });
});
