import {createPool} from 'generic-pool';
import * as mysql from 'mysql';
import { Summary, Gauge, Counter, register, Histogram } from 'prom-client';
import { ConnectionPool } from '../db/ConnectionPool';
import { DBClient, DBTransaction } from '../';
import { Transaction, TransactionManager } from '../transaction/TransactionManager';
import { LogManager } from '../log/LogManager';
const log = LogManager.getLogger(__filename);

export type MysqlConnection = mysql.IConnection;

const activeGauge = new Gauge({
    name: 'db_pool_active_connections',
    help: 'Number of active connections in the pool',
    labelNames: ['poolName'],
  });
  const connectionsCounter = new Counter({
    name: 'db_pool_connections',
    help: 'Number of established connections in all time',
    labelNames: ['poolName'],
  });
  const destroyedConnectionsCounter = new Counter({
    name: 'db_pool_destroyed_connections',
    help: 'Number of destroyed connections in all time',
    labelNames: ['poolName'],
  });
  const acquireDurationsHistogram = new Histogram({
    name: 'db_pool_acquire_time',
    help: 'Time required to acquire a connection',
    labelNames: ['poolName'],
    buckets: [0.003, 0.005, 0.01, 0.05, 0.1, 0.3]});

export interface PoolMetrics {
    active: Gauge.Internal,
    numConnections: Counter.Internal,
    numDestroyed: Counter.Internal,
    acquireDuration: Histogram.Internal,
}

export default class MysqlConnectionPool implements ConnectionPool<MysqlConnection> {

    pool;
    config: any;
    name: string;
    metrics: PoolMetrics;

    constructor(config, name) {
        this.config = config;
        this.name = name;
        this.pool = createPool({
            create: () => this.createConnection(),
            destroy: (conn) => this.destroyConnection(conn),
            validate: (conn) => this.validateConnection(conn),
        }, config);
        this.setupMetrics(name);
    }

    private setupMetrics(name) {
        this.metrics = {
            active:activeGauge.labels(name),
            numConnections: connectionsCounter.labels(name),
            numDestroyed: destroyedConnectionsCounter.labels(name),
            acquireDuration: acquireDurationsHistogram.labels(name),
        };
    }

    private async createConnection(): Promise<MysqlConnection> {
        const connection = await new Promise<MysqlConnection>((res, rej) => {
            const conn = mysql.createConnection(this.config);
            conn.release = () => this.releaseConnection(conn);
            conn.connect((err, c) => err ? rej(err) : res(conn));
        });
        this.metrics.numConnections.inc();
        log.debug(this.name, 'Connection created', this.stats());
        return connection;
    }

     private async validateConnection(connection: MysqlConnection): Promise<Boolean> {
        log.debug(this.name, 'validating connection', this.stats());
        return new Promise<Boolean>((resolve) => {
            connection.connect((err, conn) => err ? resolve(false) : resolve(true));
        });
    }

    private destroyConnection(connection: MysqlConnection) {
        connection.destroy();
        log.debug(this.name, 'Destroying connection', this.stats());
        this.metrics.numDestroyed.inc();
    }

    public async getConnection() {
        const timer = this.metrics.acquireDuration.startTimer();
        const connection = await this.pool.acquire();
        timer();
        log.debug(this.name, 'Connection accquired', this.stats());
        this.metrics.active.inc();
        return connection;
    }

    public stats() {
        return {
            capacity: this.pool.spareResourceCapacity,
            size: this.pool.size,
            available: this.pool.available,
            borrowed: this.pool.borrowed,
            pending: this.pool.pending,
            max: this.pool.max,
            min: this.pool.min,
        };
    }

    public async releaseConnection(connection) {
        if (this.pool.isBorrowedResource(connection)) {
            await this.pool.release(connection);
            this.metrics.active.dec();
            log.debug(this.name, 'Connection released', this.stats());
        }
    }

    end() {
        return this.pool.drain();
    }

}
