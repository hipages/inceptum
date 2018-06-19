export class ReadyGate {
  protected channelReadyPromise: Promise<void>;
  protected channelReadyPromiseResolve: () => void;

  async awaitChannelReady() {
    if (this.channelReadyPromise) {
      await this.channelReadyPromise;
    }
  }

  isChannelReady(): boolean {
    return this.channelReadyPromise === undefined;
  }

  channelNotReady() {
    if (!this.channelReadyPromise) {
      this.channelReadyPromise = new Promise<void>((resolve) => {
        this.channelReadyPromiseResolve = resolve;
      });
    }
  }

  channelReady() {
    if (this.channelReadyPromise && this.channelReadyPromiseResolve) {
      this.channelReadyPromiseResolve();
      this.channelReadyPromise = undefined;
    }
  }
}
