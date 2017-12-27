import { must } from 'must';
import { suite, test } from 'mocha-typescript';
import * as elasticsearch from 'elasticsearch';
import { ElasticsearchClient, ElasticsearchClientConfigObject } from '../../src/elasticsearch/ElasticsearchClient';

const elasticConfig: ElasticsearchClientConfigObject = {
  host: [{
    host: 'localhost',
    port: '9200',
    protocol: 'http',
  }],
  apiVersion: '5.5',
};

describe.only('elasticsearchClient', () => {
  let myClientConnection: ElasticsearchClient;
  let myClient: elasticsearch.Client;
  beforeEach(() => {
    myClientConnection = new ElasticsearchClient('TestElasticSearchClient', elasticConfig);
    myClientConnection.initialise();
    myClient = myClientConnection.getClient();
    },
  );
  describe('Connect', () => {
    it('Ping', () => {
      return myClient.ping({
        requestTimeout: 1000,
      })
      .then((result) => {
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
