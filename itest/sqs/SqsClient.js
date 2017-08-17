const { SqsClient } = require('../../src/sqs/SqsClient');

const myClient = new SqsClient();
myClient.name = 'TestClient';

myClient.initialise();


const msg = {
  foo: "bar"
};
const params = {
  MessageBody: JSON.stringify(msg), /* required */
  QueueUrl: 'localhost', /* required */
  DelaySeconds: 0
};

describe('SqsClient', () => {
  describe('Basic methods', () => {
    it('Send message', (done) => myClient.connection.sendMessage(params, (err, data) => {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log(data);           // successful response
        done();
      })
    );
  });
});
