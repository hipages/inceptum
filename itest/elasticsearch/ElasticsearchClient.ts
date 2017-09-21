import { ElasticsearchClient } from '../../src/elasticsearch/ElasticsearchClient';

const elasticConfig = {
  hosts: [{
    host: 'localhost',
    port: '9200',
    protocol: 'http',
  }],
  apiVersion: '5.5',
};

const myClient = new ElasticsearchClient('TestElasticSearchClient', elasticConfig);
myClient.initialise();

describe('elasticsearchClient', () => {
  describe('Connect', () => {
    it('Ping', () => {
      return myClient.ping().then((result) => {
        result.must.be.true();
      });
    });
  });
  describe('Bulk', () => {
    it('Index and Delete', () => {
      const data = {
        body: [
          { index:  { _index: 'testindex', _type: 'testtype', _id: 1 } },
          { title: 'foo1' },

          { index:  { _index: 'testindex', _type: 'testtype', _id: 2 } },
          { title: 'foo2' },

          { delete:  { _index: 'testindex', _type: 'testtype', _id: 1 } },
          { delete:  { _index: 'testindex', _type: 'testtype', _id: 2 } },
        ],
      };

      return myClient.bulk(data).then(
        (result) => {
          result.errors.must.be.false();
          result.items.length.must.be.equal(4);
        },
      );
    });
  });
});
