export enum BackPressureStrategy {
  ERROR,
  BLOCK,
}

export interface RabbitmqClientConfig {
  protocol?: string,
  hostname: string,
  port: number,
  username: string,
  password: string,
}

export interface RabbitmqProducerConfig {
  exchangeName: string,
  backPressureStrategy: BackPressureStrategy,
}

export interface RabbitmqConsumerConfig {
  appQueueName: string,
  delayQueueName: string,
  dlqName: string,
  maxRetries: number,
  retryDelayInMinute: number,
  retryDelayFactor: number,
  messageHandler?: string,
}
