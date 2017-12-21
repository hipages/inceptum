import { connect, Connection, Channel, Options } from 'amqplib';
import { RabbitmqProducerConfig, BackPressureStrategy, RabbitmqClientConfig } from './RabbitmqConfig';
import { RabbitmqClient } from './RabbitmqClient';

export class RabbitmqProducer extends RabbitmqClient {
    protected producerConfig: RabbitmqProducerConfig;

    constructor(
        clientConfig: RabbitmqClientConfig,
        name: string,
        producerConfig: RabbitmqProducerConfig ) {
            super(clientConfig, name);
            this.producerConfig = {...producerConfig};
            this.producerConfig.backPressureStrategy = producerConfig.backPressureStrategy || BackPressureStrategy.ERROR;
    }

    /**
     * publish msg with routing key
     * @param msg
     * @param routingKey
     */
    async publish(msg: string, routingKey: string, optionsPublish: Options.Publish = {}): Promise<boolean> {
        optionsPublish.headers = {
            retriesCount: 0,
        };
        while (!this.channel.publish(this.producerConfig.exchangeName, routingKey, new Buffer(msg), optionsPublish)) {
            if (this.producerConfig.backPressureStrategy === BackPressureStrategy.ERROR) {
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
