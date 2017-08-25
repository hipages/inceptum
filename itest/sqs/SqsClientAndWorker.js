const { SqsClient } = require('../../src/sqs/SqsClient');
const { SqsWorker } = require('../../src/sqs/SqsWorker');
const { SqsHandler } = require('../../src/sqs/SqsWorker');

const Queue_Url = 'localhost:9432';
const myClient = new SqsClient();
myClient.name = 'TestClient';

myClient.queueUrl = Queue_Url;
myClient.initialise();

const msg = {
  foo: "bar"
};

const params = {
  MessageBody: JSON.stringify(msg), /* required */
  DelaySeconds: 0
};


const myWorker = new SqsWorker();
myWorker.name = 'TestWorker';
myWorker.queueUrl = Queue_Url;


class myHandler extends SqsHandler {
  static handle(message, done) {
    console.log(message);
    try {
      done();
    } catch (err) {
      if (message.Attributes.ApproximateReceiveCount > myWorker.getMaxRetries()) {
        done();
      } else {
        done(err);
      }
    }
  };
}
myWorker.handler = myHandler;

describe('SqsClient', () => {
  describe('Basic methods', () => {
    it('Send message', (done) => myClient.sendMessage(params, (err, data) => {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log(data);           // successful response
        done();
      })
    );
  });
});

describe('SqsWorker', () => {
  describe('Basic methods', () => {
    it('Polling message', (done) => {
        myWorker.initialise();
        setTimeout(done, 1000);
      }
    );
  });
});
