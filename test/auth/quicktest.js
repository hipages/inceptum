const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const pub3 = fs.readFileSync(path.join(__dirname, 'service/public.pem'));
const priv3 = fs.readFileSync(path.join(__dirname, 'service/private.pem'));

// To generate the key pair:
// ssh-keygen -t rsa -b 1024 -f private.pem
// This will generate a file called private.pem for the private key, and private.pem.pub for a signature
// To generate the public key in pem format
// openssl rsa -in private.pem -pubout -out public.pem


describe('JWT Test', () => {
  it('JWT', () => {
    const token = jwt.sign({ foo: 'bar' }, priv3, { algorithm: 'RS512' });
    console.log(`Token: ${token}`);

    return new Promise((resolve) => {
      const max = 100;
      const times = [];
      const starts = [];
      for (let i = 0; i < max; i++) {
        const start = Date.now();
        starts.push(start);
        jwt.verify(token, pub3, () => {
          // decoded.foo.must.be.equal('bar');
          times.push(Date.now() - start);
          if (i === (max - 1)) {
            resolve({ starts, times });
          }
        });
      }
    })
    .then((obj) => {
      const starts = obj.starts;
      const times = obj.times;
      for (let i = 0; i < starts.length; i++) {
        console.log(i, starts[i], times[i]);
      }
    });
  });
  it('JWT RSA', () => {
    const token = jwt.sign({ foo: 'bar' }, priv3, { algorithm: 'RS512' });
    console.log(`Token: ${token}`);

    return new Promise((resolve) => {
      const max = 1000;
      const times = [];
      const starts = [];
      for (let i = 0; i < max; i++) {
        process.nextTick(() => {
          const start = Date.now();
          starts.push(start);
          jwt.verify(token, pub3, () => {
            // decoded.foo.must.be.equal('bar');
            times.push(Date.now() - start);
            if (i === (max - 1)) {
              resolve({ starts, times });
            }
          });
        });
      }
    })
    .then((obj) => {
      const starts = obj.starts;
      const times = obj.times;
      for (let i = 0; i < starts.length; i++) {
        console.log(i, starts[i], times[i]);
      }
    });
  });
});
