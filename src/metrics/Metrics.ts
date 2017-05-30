import * as prometheus from 'prom-client';
import { Context } from '../ioc/Context';
import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import { LogManager } from '../log/LogManager';
const logger = LogManager.getLogger(__filename);

interface labelValues {
	[key: string]: string|number
}

/**
 * A counter is a cumulative metric that represents a single numerical value that only ever goes up
 */
export interface Counter {

	/**
	 * Increment for given labels
	 * @param labels Object with label keys and values
	 * @param value The number to increment with
	 */
	inc(labels: labelValues, value?: number): void

	/**
	 * Increment with value
	 * @param value The value to increment with
	 */
	inc(value?: number): void
}

export interface Gauge {
	/**
	 * Increment gauge for given labels
	 * @param labels Object with label keys and values
	 * @param value The value to increment with
	 */
	inc(labels: labelValues, value?: number): void

	/**
	 * Increment gauge
	 * @param value The value to increment with
	 */
	inc(value?: number): void

	/**
	 * Decrement gauge
	 * @param labels Object with label keys and values
	 * @param value Value to decrement with
	 */
	dec(labels: labelValues, value?: number): void

	/**
	 * Decrement gauge
	 * @param value The value to decrement with
	 */
	dec(value?: number): void


	/**
	 * Set gauge value for labels
	 * @param lables Object with label keys and values
	 * @param value The value to set
	 */
	set(labels: labelValues, value: number): void

	/**
	 * Set gauge value
	 * @param value The value to set
	 */
	set(value: number): void

	/**
	 * Set gauge value to current epoch time in ms
	 * @param labels Object with label keys and values
	 */
	setToCurrentTime(labels?: labelValues): void

	/**
	 * Start a timer where the gauges value will be the duration in seconds
	 * @param labels Object with label keys and values
	 * @return Function to invoke when timer should be stopped
	 */
	startTimer(labels?: labelValues): (labels?: labelValues) => void
}

/**
 * A summary samples observations
 */
export interface Histogram {
	/**
	 * Observe value in summary
	 * @param value The value to observe
	 */
	observe(value: number): void
	/**
	 * Observe value for given labels
	 * @param labels Object with label keys and values
	 * @param value Value to observe
	 */
	observe(labels: labelValues, value: number): void
	/**
	 * Start a timer where the value in seconds will observed
	 * @param labels Object with label keys and values
	 * @return Function to invoke when timer should be stopped
	 */
	startTimer(labels?: labelValues): (labels?: labelValues) => void
	/**
	 * Reset all values in the summary
	 */
	reset(): void
}

class MetricsServiceInternal {
  gaugeCache: Map<string, Gauge>;
  counterCache: Map<string, Counter>;
  histogramCache: Map<string, Histogram>;

  constructor() {
    this.counterCache = new Map<string, prometheus.Counter>();
    this.gaugeCache = new Map<string, prometheus.Gauge>();
  }

  protected getOrCreate(map: Map<string, any>, name: string, creator: ()=>any) {
    if (map.has(name)) {
      return map.get(name);
    }
    const metric = creator();
    map.set(name, metric);
    return metric;
  }

  counter(metricName, labels = [], metricHelp?: string): Counter {
    return this.getOrCreate(this.counterCache, `Counter:${metricName}:${labels.join(';')}`, () => new prometheus.Counter(metricName, metricHelp || metricName, labels));
  }
  gauge(metricName, labels = [], metricHelp?: string): Gauge {
    return this.getOrCreate(this.gaugeCache, `Gauge:${metricName}:${labels.join(';')}`, () => new prometheus.Gauge(metricName, metricHelp || metricName, labels));
  }

  /**
   * Get a histogram to update
   * @param metricName
   * @param labels
   * @param metricHelp
   * @return {Summary}
   */
  histogram(metricName, labels = [], metricHelp?: string): Histogram {
    return this.getOrCreate(this.histogramCache, `Histogram:${metricName}:${labels.join(';')}`,
      () => new prometheus.Summary(metricName, metricHelp || metricName, labels, {
        percentiles: [0.5, 0.75, 0.9, 0.99, 0.999]
      }));
  }
}

export const MetricsService = new MetricsServiceInternal();

export class MetricsManager {
  static setup(appName: string) {
    const defaultMetrics = prometheus.defaultMetrics;

    // Skip `osMemoryHeap` probe, and probe every 5th second.
    const defaultInterval = defaultMetrics(['osMemoryHeap'], 10000);
    process.on('exit', () => { clearInterval(defaultInterval); });

    if (Context.hasConfig('metrics.gateway') &&
      Context.hasConfig('metrics.gateway.active') &&
      Context.getConfig('metrics.gateway.active')
    ) {
      const gateway = new prometheus.Pushgateway(Context.getConfig('metrics.gateway.hostport'));
      const tags = {
        jobName: 'msPush',
        appName
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

  static registerSingletons(appName: string, context: Context) {
    MetricsManager.setup(appName);
    // eslint-disable-next-line no-use-before-define
    context.registerDefinition(new PreinstantiatedSingletonDefinition(MetricsService, 'MetricsService'));
  }
}

// module.exports = { MetricsManager, MetricsService: SINGLETON };
