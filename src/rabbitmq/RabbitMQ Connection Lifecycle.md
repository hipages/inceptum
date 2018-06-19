RabbitMQ Connection Lifecycle
===========

There's a couple of concepts that are important to keep in mind when understanding how to manage connections to RabbitMQ

* Connection: Refers to the actual TCP connection with the RabbitMQ server
* Channel: Is a Virtual connection, and there may be multiple Channels being multiplexed in a Connection.

The process of connecting, therefore, has two stages, one to establish the connection and later one to establish a channel.
This is what the content of the `RabbitmqClient#connect`.

```
  /**
   * Connect to RabbitMQ broker
   */
  protected async connect(): Promise<void> {
    await this.createConnection();
    await this.createChannel();
  }
```

This is easy so far, the complexity comes with error handling.

Event Handlers
-----
Both the Connection and the Channel emit two events of interest for connection management:
* `closed`: To indicate that the Channel/Connection has closed. This can represent either a "normal" shutdown or a forced/failed close.
* `error`: A Connection/Channel error. Not specific to delivery, but to an error on the Connection/Channel. Always unexpected and undesired.

These events are not mutually exclusive, so you could receive the following events:
* `Channel.error`
* `Connection.error`
* `Connection.closed`

all consecutively signaling the unexpected end of a Connection.

How we handle it
--------
To simplify the process and guarantee consistency in the management of the connection lifecycle we manage any of the events (both error or closed on either the Channel or the Connection) as signals that the whole Connection/Channel pair is in a bad state and need to be recreated.

Because the timing of these events are not documented to happen in any timeframe or order, we set a timer to give time for all these events to be received.

How we handle normal shutdown
--------
As the `closed` events are also sent during a normal shutdown, we remove all the event listeners during a normal shutdown.