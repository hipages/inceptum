import { ConsumeOptions } from './RabbitmqClient';

export enum RabbitmqBackPressureStrategy {
  ERROR,
  BLOCK,
}

export interface RabbitmqClientConfig {
  protocol?: string,
  hostname: string,
  port: number,
  username: string,
  password: string,
  mgtHttpHost: string,
  mgtHttpPort: number,
  mgtHttpTheme: string,
  maxConnectionAttempts?: number,
  exitOnIrrecoverableReconnect?: boolean,
  healthCheckEnabled?: boolean,
  heartbeat?: number,
}

export const DEFAULT_MAX_CONNECTION_ATTEMPTS = 3;

export interface RabbitmqProducerConfig {
  exchangeName: string,
  backPressureStrategy: RabbitmqBackPressureStrategy,
}

export interface RabbitmqConsumerConfig {
  appQueueName: string,
  delayQueueName: string,
  dlqName: string,
  maxRetries: number,
  retryDelayInMinute: number,
  retryDelayFactor: number,
  messageHandler?: string,
  prefetch?: number,
  options?: ConsumeOptions,
}
