import { must } from 'must';
import { suite, test, slow, timeout, skip } from 'mocha-typescript';
import { ReadyGate } from '../../src/util/ReadyGate';

suite('util/ReadyGate', () => {
  test('ReadyGate is ready by default', () => {
    const gate = new ReadyGate();
    gate.isChannelReady().must.be.true();
  });
  test('Once it\'s marked as not ready it comes back as not ready', () => {
    const gate = new ReadyGate();
    gate.channelNotReady();
    gate.isChannelReady().must.be.false();
  });
  test('Once it\'s marked as ready it comes back as ready', () => {
    const gate = new ReadyGate();
    gate.channelNotReady();
    gate.channelReady();
    gate.isChannelReady().must.be.true();
  });
  test('Await returns immediately if the gate is ready', async () => {
    const gate = new ReadyGate();
    const ready = {ready: false};
    const promise = gate.awaitChannelReady().then(() => { ready.ready = true; });
    await new Promise<void>((resolve) => { setTimeout(resolve, 0);});
    ready.ready.must.be.true();
  });

  test('Await does not return immediately if the gate is not ready', async () => {
    const gate = new ReadyGate();
    gate.channelNotReady();
    const ready = {ready: false};
    gate.awaitChannelReady().then(() => { ready.ready = true; });
    await new Promise<void>((resolve) => { setTimeout(resolve, 50);});
    ready.ready.must.be.false();
    gate.channelReady();
    gate.awaitChannelReady().then(() => { ready.ready = true; });
    await new Promise<void>((resolve) => { setTimeout(resolve, 0);});
    ready.ready.must.be.true();
  });
});
