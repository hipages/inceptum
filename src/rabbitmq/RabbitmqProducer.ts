import { connect, Connection, Channel } from 'amqplib';
import { LogManager } from '../log/LogManager';
import { RabbitmqProducerConfig, RabbitmqBackPressureStrategy, RabbitmqClientConfig } from './RabbitmqConfig';
import { PublishOptions, RabbitmqClient } from './RabbitmqClient';

const logger = LogManager.getLogger(__filename);

export class RabbitmqProducer extends RabbitmqClient {
    protected producerConfig: RabbitmqProducerConfig;

    constructor(
        clientConfig: RabbitmqClientConfig,
        name: string,
        producerConfig: RabbitmqProducerConfig ) {
            super(clientConfig, name);
            this.producerConfig = {...producerConfig};
            this.producerConfig.backPressureStrategy = producerConfig.backPressureStrategy || RabbitmqBackPressureStrategy.ERROR;
            this.logger = logger;
    }

    /**
     * publish msg with routing key
     * @param msg
     * @param routingKey
     */
    async publish(msg: string, routingKey: string, optionsPublish: PublishOptions = {}): Promise<boolean> {
        optionsPublish.headers = {
            retriesCount: 0,
        };
        while (!this.channel.publish(this.producerConfig.exchangeName, routingKey, new Buffer(msg), optionsPublish)) {
            if (this.producerConfig.backPressureStrategy === RabbitmqBackPressureStrategy.ERROR) {
                throw new Error('Failed to publish message');
            }

            this.logger.error(`publish failed. ====> ${msg}`);
            await new Promise<void>((resolve: () => void, reject: () => void) => {
                this.channel.once('drain', function() {
                    this.logger.info(`drain event received. ====> ${msg}`);
                    resolve();
                });
            });
        }

        return Promise.resolve(true);
    }

    async init(): Promise<void> {
        await super.init();
    }

    async close(): Promise<void> {
        await super.close();
    }
}
