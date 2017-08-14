// tslint:disable:prefer-function-over-method
import { MetricsManager } from '../metrics/Metrics';
import { Plugin } from './BaseApp';

export default class MetricPlugin implements Plugin {
  name = 'MetricsPlugin';

  willStart(app) {
    const appName = app.getConfig('app.name', 'TestApp');
    const context = app.getContext();
    MetricsManager.registerSingletons(appName, context);
  }
}
