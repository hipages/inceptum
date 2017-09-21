import * as elasticsearch from 'elasticsearch';

export interface ElasticsearchClientConfigObject {
    hosts?: any,
    apiVersion?: string,
}

export class ElasticsearchClient {
    static startMethod = 'initialise';

    public name: string;
    public configuration: ElasticsearchClientConfigObject;

    private connection: elasticsearch.Client;

    constructor(name: string, config: ElasticsearchClientConfigObject) {
        this.name = name;
        this.configuration = Object.assign({}, config);

        this.initialise();
    }

    initialise() {
        this.connection = new elasticsearch.Client(this.configuration);
    }

    ping(params?: object) {
        return this.connection.ping(params);
    }

    bulk(params: object) {
        return this.connection.bulk(params);
    }
}
