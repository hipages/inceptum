import * as Prometheus from 'prom-client';
import LogManager from '../log/LogManager';
const { Context } = require('../ioc/Context');
const { PreinstantiatedSingletonDefinition } = require('../ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const logger = LogManager.getLogger(__filename);


type Metric = Prometheus.Counter | Prometheus.Gauge | Prometheus.Summary | Prometheus.Histogram

class MetricsService {

  metricsCache: Map<string, Metric>;

  constructor() {
    this.metricsCache = new Map();
  }

  getOrCreate(name, creator: () => Metric) {
    if (this.metricsCache.has(name)) {
      return this.metricsCache.get(name);
    }
    const metric = creator();
    this.metricsCache.set(name, metric);
    return metric;
  }

  counter(metricName, labels = [], metricHelp) {
    return this.getOrCreate(`Counter:${metricName}:${labels.join(';')}`, () => new Prometheus.Counter(metricName, metricHelp || metricName, labels));
  }
  gauge(metricName, labels = [], metricHelp) {
    return this.getOrCreate(`Gauge:${metricName}:${labels.join(';')}`, () => new Prometheus.Gauge(metricName, metricHelp || metricName, labels));
  }

  /**
   * Get a histogram to update
   * // TODO Should this be summary?
   * @param metricName
   * @param labels
   * @param metricHelp
   * @return {Summary}
   */
  histogram(metricName, labels = [], metricHelp) {
    return this.getOrCreate(`Histogram:${metricName}:${labels.join(';')}`,
      () => new Prometheus.Summary(metricName, metricHelp || metricName, labels, {
        percentiles: [0.5, 0.75, 0.9, 0.99, 0.999]
      }));
  }
}

const SINGLETON = new MetricsService();

class MetricsManager {
  static setup(jobName) {
    const defaultMetrics = Prometheus.defaultMetrics;

    // Skip `osMemoryHeap` probe, and probe every 5th second.
    const defaultInterval = defaultMetrics(['osMemoryHeap'], 10000);
    process.on('exit', () => { clearInterval(defaultInterval); });

    if (Context.hasConfig('metrics.gateway') &&
      Context.hasConfig('metrics.gateway.active') &&
      Context.getConfig('metrics.gateway.active')
    ) {
      const gateway = new Prometheus.Pushgateway(Object.assign(Context.getConfig('metrics.gateway.hostport'), { timeout: 2000 }));
      const tags = {
        jobName
      };
      const interval = setInterval(() => {
        gateway.pushAdd(tags, (err) => {
          if (err) {
            logger.error({ err }, `There was an error pushing stats to the metrics gateway: ${Context.getConfig('metrics.gateway.hostport')}`);
          }
        });
      });
      process.on('exit', () => {
        clearInterval(interval);
        gateway.pushAdd(tags, (err) => {
          if (err) {
            logger.error({ err }, 'There was an error trying to push stats one last time. Will try to delete anyway');
          }
          gateway.delete(tags, (err) => {
            if (err) {
              logger.error({ err }, `There was an error deleting stats for ${JSON.stringify(tags)} ` +
                `from the metrics gateway: ${Context.getConfig('metrics.gateway.hostport')}`);
            }
          });
        });
      });
    }
  }

  static registerSingletons(appName, context) {
    MetricsManager.setup(appName);
    // eslint-disable-next-line no-use-before-define
    context.registerDefinition(new PreinstantiatedSingletonDefinition(SINGLETON, 'MetricsService'));
  }
}

module.exports = { MetricsManager, MetricsService: SINGLETON };
