const { SqsWorker } = require('../../src/sqs/SqsWorker');

const myWoker = new SqsWorker();
myWoker.name = 'TestClient';

myWoker.configuration = {
  queueUrl: 'localhost',
};

myWoker.handler = (message, done) => {
  console.log(message);
  done();
};

myWoker.initialise();

describe('SqsWorker', () => {
  describe('Basic methods', () => {
    it('Polling message', (done) => {
        myWoker.poll();
        setTimeout(done, 1000);
      }
    );
  });
});
