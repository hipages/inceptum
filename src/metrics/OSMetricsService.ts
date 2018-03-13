import * as fs from 'fs';
import { LogManager } from '../log/LogManager';

export const CPUOSMetricNames = [ 'ctxtSwaps', 'steal', 'softirq', 'irq', 'iowait', 'idle', 'system', 'nice', 'user' ];
export const LoadOSMetricNames = [ 'load15', 'load5', 'load1' ];

export class OSMetrics {
  load15: number;
  load5: number;
  load1: number;
  ctxtSwaps: number;
  steal: number;
  softirq: number;
  irq: number;
  iowait: number;
  idle: number;
  system: number;
  nice: number;
  user: number;
}

const PROC_STAT = '/proc/stat';
const PROC_LOADAVG = '/proc/loadavg';
const logger = LogManager.getLogger(__filename);

export class OSMetricsService {
  procLoadAvgExists: boolean;
  procStatExists: boolean;
  procStatContentReader: () => string;
  procLoadAvgContentReader: () => string;

  constructor() {
    this.procStatExists = fs.existsSync(PROC_STAT);
    this.procLoadAvgExists = fs.existsSync(PROC_LOADAVG);
    this.procStatContentReader = () => fs.readFileSync(PROC_STAT, 'utf8');
    this.procLoadAvgContentReader = () => fs.readFileSync(PROC_LOADAVG, 'utf8');
  }

  readCPUStat(oSMetrics: OSMetrics): void {
    const fileContent = this.procStatContentReader();
    // logger.debug(`Got ${PROC_STAT}: ${fileContent}`);
    this.parseCPUStatFile(fileContent, oSMetrics);
  }

  parseCPUStatFile(fileContent: string, oSMetrics: OSMetrics): void {
    const lines = fileContent.split(/[\n\r]+/);
    lines.forEach((line) => {
      this.parseCPUStatLine(line, oSMetrics);
    });
  }

  readLoadAvg(oSMetrics: OSMetrics): void {
    const fileContent = this.procLoadAvgContentReader();
    // logger.debug(`Got ${PROC_LOADAVG}: ${fileContent}`);
    this.parseLoadAvgFile(fileContent, oSMetrics);
  }

  parseLoadAvgFile(fileContent: string, oSMetrics: OSMetrics): void {
    const parts = fileContent.split(/[ ]+/);
    oSMetrics.load1 = parseFloat(parts[0]);
    oSMetrics.load5 = parseFloat(parts[1]);
    oSMetrics.load15 = parseFloat(parts[2]);
  }

  parseCPUStatLine(line: string, oSMetrics: OSMetrics): void {
    const parts = line.split(/[ ]+/);
    switch(parts[0]) {
      case 'cpu':
        oSMetrics.user = parseInt(parts[1], 10);
        oSMetrics.nice = parseInt(parts[2], 10);
        oSMetrics.system = parseInt(parts[3], 10);
        oSMetrics.idle = parseInt(parts[4], 10);
        oSMetrics.iowait = parseInt(parts[5], 10);
        oSMetrics.irq = parseInt(parts[6], 10);
        oSMetrics.softirq = parseInt(parts[7], 10);
        oSMetrics.steal = parseInt(parts[8], 10);
        break;
      case 'ctxt':
        oSMetrics.ctxtSwaps = parseInt(parts[1], 10);
    }
  }

  public getOSMetrics(): OSMetrics {
    const resp = new OSMetrics();
    if (this.procStatExists) {
      try {
        this.readCPUStat(resp);
      } catch (e) {
        logger.warn(e, 'There was an error trying to gather CPU stats');
      }
    }
    if (this.procLoadAvgExists) {
      try {
        this.readLoadAvg(resp);
      } catch (e) {
        logger.warn(e, 'There was an error trying to gather CPU stats');
      }
    }
    return resp;
  }
}

/*
 * Example output of /proc/stat
 * bash-4.3# cat /proc/stat
 * cpu  7295284 99386 1983452 15027614 314428 0 310148 24617 0 0
 * cpu0 3501047 46818 959869 7568112 154641 0 265927 11233 0 0
 * cpu1 3794236 52567 1023583 7459502 159787 0 44220 13384 0 0
 * intr 598999980 31 9 0 0 1748 0 0 0 2 0 0 0 3 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 108575587 27725464 0 0 2397087 0 106721474 72735065 0 0 2494153 0 161 14493467 79855109 78647982 20 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
 * ctxt 717991087
 * btime 1520765073
 * processes 908712
 * procs_running 1
 * procs_blocked 0
 * softirq 507911845 0 55816109 30052 291757370 0 0 30751 36539917 0 123737646
 *
 * bash-4.3# cat /proc/loadavg
 * 1.08 1.28 1.47 4/1304 99
 */
