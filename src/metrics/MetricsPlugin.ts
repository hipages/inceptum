// tslint:disable:prefer-function-over-method
import * as e from 'express';
import * as prometheus from 'prom-client';
import * as gcStats from 'prometheus-gc-stats';

import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import AdminPortPlugin from '../web/AdminPortPlugin';
import { LogManager } from '../log/LogManager';
import WebPlugin from '../web/WebPlugin';
import { OSMetrics, OSMetricsService, CPUOSMetricNames, LoadOSMetricNames } from './OSMetricsService';

const Logger = LogManager.getLogger(__filename);

export default class MetricsPlugin implements Plugin {
  statsTimer: number;
  loadStats: prometheus.Gauge;
  cpuStats: prometheus.Counter;
  lastMetrics: OSMetrics;
  name = 'MetricsPlugin';

  prometheusTimer: number;
  osMetricsService = new OSMetricsService();

  getName() {
    return this.name;
  }

  didStart(app: BaseApp, pluginContext: PluginContext) {
    this.prometheusTimer = prometheus.collectDefaultMetrics();
    prometheus.register.setDefaultLabels({app: app.getConfig('app.name', 'not_set')});
    const startGcStats = gcStats();
    startGcStats();
    this.registerOSMetrics(app);

    const context = app.getContext();
    const adminExpress: e.Express = pluginContext.get(AdminPortPlugin.CONTEXT_APP_KEY);
    if (adminExpress) {
      Logger.info('Registering metrics endpoint in Admin port');
      adminExpress.get('/metrics', async (req, res) => {
          res.type('text/plain');
          res.send(prometheus.register.metrics());
      });
    }
  }

  registerOSMetrics(app: BaseApp) {
    if (app.getConfig('metrics.osmetrics.enabled', 'true') !== 'false') {
      this.lastMetrics = this.osMetricsService.getOSMetrics();
      if (this.lastMetrics.user !== undefined) {
        // We're able to collect cpu stats. Let's register this Counter
        this.cpuStats = new prometheus.Counter({
          name: 'proc_cpu',
          help: 'CPU stats from the OS',
          labelNames: ['type'],
        });
      } else {
        Logger.info('Can\'t collect cpu stats (this OS doesn\'t have procfs mounted!. Skipping');
      }
      if (this.lastMetrics.load1 !== undefined) {
        // We're able to collect load stats. Let's register this Gauge
        this.loadStats = new prometheus.Gauge({
          name: 'proc_load',
          help: 'Load information',
          labelNames: ['period'],
        });
      } else {
        Logger.info('Can\'t collect load average stats (this OS doesn\'t have procfs mounted!. Skipping');
      }
      const interval = app.getConfig('metrics.osmetrics.refreshMillis', 20000);
      this.statsTimer = setInterval(() => {this.pushStats();}, typeof interval === 'string' ? parseInt(interval, 10) : interval);
    }
  }

  pushStats() {
    const newStats = this.osMetricsService.getOSMetrics();
    if (this.cpuStats) {
      CPUOSMetricNames.forEach((name) => this.pushIndividualCPUStat(name, newStats));
    }
    if (this.loadStats) {
      LoadOSMetricNames.forEach((name) => this.pushIndividualLoadStat(name, newStats));
    }
    this.lastMetrics = newStats;
  }

  pushIndividualCPUStat(name: string, newStats: OSMetrics): void {
    if (newStats[name] !== undefined && this.lastMetrics[name] !== undefined) {
      this.cpuStats.inc({type: name}, newStats[name] - this.lastMetrics[name]);
    }
  }

  pushIndividualLoadStat(name: string, newStats: OSMetrics): void {
    if (newStats[name] !== undefined && this.lastMetrics[name] !== undefined) {
      this.loadStats.set({type: name}, newStats[name]);
    }
  }

  didStop() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
    }
    prometheus.register.clear();
    if (this.prometheusTimer) {
      Logger.info('Shutting down prometheus interval');
      clearInterval(this.prometheusTimer);
    }
  }
}
