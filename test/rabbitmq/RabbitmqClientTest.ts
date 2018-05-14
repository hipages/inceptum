import { suite, test } from 'mocha-typescript';
import * as sinon from 'sinon';
import { must } from 'must';
import * as amqplib from 'amqplib';
import { RabbitmqClient } from '../../src/rabbitmq/RabbitmqClient';
import { RabbitmqClientConfig } from '../../src/rabbitmq/RabbitmqConfig';

enum ConnectionRecoveryElement {
  Connection,
  Channel,
}

enum ConnectionRecoveryAction {
  Error = 'error',
  Close = 'close',
}

interface ConnectionRecoveryParams {
  element: ConnectionRecoveryElement,
  action: ConnectionRecoveryAction,
  error?: string,
  expectedConnectCallCount: number,
  expectedChannelRemoveAllListenersCallCount: number,
  expectedChannelCloseCallCount: number,
  expectedConnectionRemoveAllListenersCallCount: number,
  expectedConnectionCloseCallCount: number,
}

@suite
class RabbitmqClientTest {
  async testConnectionRecovery(params: ConnectionRecoveryParams) {
    // Setup
    const channelHandler = {
      handlers: [],

      removeAllListeners() {
        this.handlers = [];
      },

      on(event, handler) {
        this.handlers[event] = handler;
      },

      close() {
        if (this.handlers['close']) {
          this.handlers['close']();
        }
      },

      error(err) {
        if (this.handlers['error']) {
          this.handlers['error'](err);
        }
        this.close();
      },
    };

    const channelRemoveAllListenersSpy = sinon.spy(channelHandler, 'removeAllListeners');
    const channelCloseSpy = sinon.spy(channelHandler, 'close');

    const connectionHandler = {
      handlers: [],
      channel: null,

      removeAllListeners() {
        this.handlers = [];
      },

      on(event, handler) {
        this.handlers[event] = handler;
      },

      close() {
        if (this.channel) {
          this.channel.close();
          this.channel = null;
        }
        if (this.handlers['close']) {
          this.handlers['close']();
        }
      },

      error(err) {
        if (this.handlers['error']) {
          this.handlers['error'](err);
        }
        this.close();
      },

      createChannel() {
        this.channel = channelHandler;
        return this.channel;
      },
    };

    const connectionRemoveAllListenersSpy = sinon.spy(connectionHandler, 'removeAllListeners');
    const connectionCloseSpy = sinon.spy(connectionHandler, 'close');

    const client = new RabbitmqClient({}, 'test');
    client.logger = {
      info: console.log,
      warn: console.log,
      error: console.log,
    };

    const connectStub = sinon.stub(amqplib, 'connect');
    connectStub.returns(new Promise((resolve) => {
      resolve(connectionHandler);
    }));

    sinon.stub(client, 'scheduleReconnectionAttempts', client.attemptReconnection);

    const resetHistory = () => {
      connectStub.reset();
      channelRemoveAllListenersSpy.reset();
      channelCloseSpy.reset();
      connectionRemoveAllListenersSpy.reset();
      connectionCloseSpy.reset();
    };

    const e = params.element === ConnectionRecoveryElement.Connection ? connectionHandler : channelHandler;

    // Begin test
    await client.init();
    resetHistory();

    e[params.action](params.error);
    await new Promise((resolve) => setTimeout(resolve, 100));
    connectStub.restore();

    connectStub.callCount.must.equal(params.expectedConnectCallCount);
    channelRemoveAllListenersSpy.callCount.must.equal(params.expectedChannelRemoveAllListenersCallCount);
    channelCloseSpy.callCount.must.equal(params.expectedChannelCloseCallCount);
    connectionRemoveAllListenersSpy.callCount.must.equal(params.expectedConnectionRemoveAllListenersCallCount);
    connectionCloseSpy.callCount.must.equal(params.expectedConnectionCloseCallCount);
  }

  @test
  async 'Connection Recovery: Connection close'() {
    await this.testConnectionRecovery({
      element: ConnectionRecoveryElement.Connection,
      action: ConnectionRecoveryAction.Close,
      expectedConnectCallCount: 1,
      expectedChannelRemoveAllListenersCallCount: 1,
      expectedChannelCloseCallCount: 2,
      expectedConnectionRemoveAllListenersCallCount: 1,
      expectedConnectionCloseCallCount: 2,
    });
  }

  @test
  async 'Connection Recovery: Connection error'() {
    await this.testConnectionRecovery({
      element: ConnectionRecoveryElement.Connection,
      action: ConnectionRecoveryAction.Error,
      error: 'Connection has exploded',
      expectedConnectCallCount: 1,
      expectedChannelRemoveAllListenersCallCount: 1,
      expectedChannelCloseCallCount: 2,
      expectedConnectionRemoveAllListenersCallCount: 1,
      expectedConnectionCloseCallCount: 2,
    });
  }

  @test
  async 'Connection Recovery: Channel close'() {
    await this.testConnectionRecovery({
      element: ConnectionRecoveryElement.Channel,
      action: ConnectionRecoveryAction.Close,
      expectedConnectCallCount: 1,
      expectedChannelRemoveAllListenersCallCount: 1,
      expectedChannelCloseCallCount: 3,
      expectedConnectionRemoveAllListenersCallCount: 1,
      expectedConnectionCloseCallCount: 1,
    });  }

  @test
  async 'Connection Recovery: Channel error'() {
    await this.testConnectionRecovery({
      element: ConnectionRecoveryElement.Channel,
      action: ConnectionRecoveryAction.Error,
      error: 'Channel is no more',
      expectedConnectCallCount: 1,
      expectedChannelRemoveAllListenersCallCount: 1,
      expectedChannelCloseCallCount: 3,
      expectedConnectionRemoveAllListenersCallCount: 1,
      expectedConnectionCloseCallCount: 1,
    });
  }
}
