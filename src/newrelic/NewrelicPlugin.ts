// tslint:disable:prefer-function-over-method
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { LogManager } from '../log/LogManager';
import { NewrelicUtil } from './NewrelicUtil';

const logger = LogManager.getLogger(__filename);

export default class NewrelicPlugin implements Plugin {

  name = 'NewrelicPlugin';

  public CONTEXT_APP_KEY = 'NewrelicPlugin/newrelic';

  willStart(app: BaseApp, pluginContext: PluginContext) {
    if (NewrelicUtil.isNewrelicAvailable()) {
      // pluginContext.set(this.CONTEXT_APP_KEY, NewrelicUtil.getNewrelicIfAvailable());
      logger.info('Started newrelic plugin');
    } else {
      logger.info('newrelic is not present. Ignoring');
    }
  }

  willStop(app, pluginContext) {
    const newrelic = NewrelicUtil.getNewrelicIfAvailable();
    if (newrelic) {
      return new Promise<void>((resolve, reject) => {
        logger.info('Shutting down newrelic');
        return newrelic.shutdown({collectPendingData: true, timeout: 5000}, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    return Promise.resolve();
  }
}
