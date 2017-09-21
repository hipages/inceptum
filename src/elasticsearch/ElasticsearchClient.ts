import * as elasticsearch from 'elasticsearch';

export interface ElasticsearchClientConfigObject {
    hosts?: any,
    apiVersion?: string,
}

export class ElasticsearchClient {
    static startMethod = 'initialise';
    static stopMethod = 'close';

    public name: string;
    public configuration: ElasticsearchClientConfigObject;

    private connection: elasticsearch.Client;

    constructor(name: string, config: ElasticsearchClientConfigObject) {
        this.name = name;
        this.configuration = Object.assign({}, config);
    }

    initialise() {
        this.connection = new elasticsearch.Client(this.configuration);
    }

    getClientConfiguration() {
        return this.configuration;
    }

    ping(params?: object) {
        return this.connection.ping(params);
    }

    bulk(params: object) {
        return this.connection.bulk(params);
    }

    clearScroll(params: Elasticsearch.ClearScrollParams): Promise<any> {
        return this.connection.clearScroll(params);
    }

    count(params: Elasticsearch.CountParams): Promise<Elasticsearch.CountResponse> {
        return this.connection.count(params);
    }

    create(params: Elasticsearch.CreateDocumentParams, callback: (err: any, response: Elasticsearch.CreateDocumentResponse, status: any) => void): void {
        this.connection.create(params, callback);
    }

    delete(params: Elasticsearch.DeleteDocumentParams, callback: (error: any, response: Elasticsearch.DeleteDocumentResponse) => void): void {
        this.connection.delete(params, callback);
    }

    deleteByQuery(params: Elasticsearch.DeleteDocumentByQueryParams, callback: (error: any, response: Elasticsearch.DeleteDocumentByQueryResponse) => void): void {
        this.connection.deleteByQuery(params, callback);
    }

    deleteScript(params: Elasticsearch.DeleteScriptParams, callback: (error: any, response: any) => void): void {
        this.connection.deleteScript(params, callback);
    }

    deleteTemplate(params: Elasticsearch.DeleteTemplateParams, callback: (error: any, response: any) => void): void {
        this.connection.deleteTemplate(params, callback);
    }

    exists(params: Elasticsearch.ExistsParams, callback: (error: any, response: any, status?: any) => void): void {
        this.connection.exists(params, callback);
    }

    explain(params: Elasticsearch.ExplainParams, callback: (error: any, response: Elasticsearch.ExplainResponse) => void): void {
        this.connection.explain(params, callback);
    }

    fieldStats(params: Elasticsearch.FieldStatsParams, callback: (error: any, response: Elasticsearch.FieldStatsResponse) => void): void {
        this.connection.fieldStats(params, callback);
    }

    get<T>(params: Elasticsearch.GetParams): Promise<Elasticsearch.GetResponse<T>> {
        return this.connection.get(params);
    }

    getScript(params: Elasticsearch.GetScriptParams, callback: (error: any, response: any) => void): void {
        this.connection.getScript(params, callback);
    }

    getSource(params: Elasticsearch.GetSourceParams, callback: (error: any, response: any) => void): void {
        this.connection.getSource(params, callback);
    }

    getTemplate(params: Elasticsearch.GetTemplateParams, callback: (error: any, response: any) => void): void {
        this.connection.getTemplate(params, callback);
    }

    index<T>(params: Elasticsearch.IndexDocumentParams<T>, callback: (error: any, response: any) => void): void {
        this.connection.index(params, callback);
    }

    info(params: Elasticsearch.InfoParams, callback: (error: any, response: any) => void): void {
        this.connection.info(params, callback);
    }

    mget<T>(params: Elasticsearch.MGetParams): Promise<Elasticsearch.MGetResponse<T>> {
        return this.connection.mget(params);
    }

    msearch<T>(params: Elasticsearch.MSearchParams): Promise<Elasticsearch.MSearchResponse<T>> {
        return this.connection.msearch(params);
    }

    msearchTemplate<T>(params: Elasticsearch.MSearchTemplateParams): Promise<Elasticsearch.MSearchResponse<T>> {
        return this.connection.msearchTemplate(params);
    }

    mtermvectors(params: Elasticsearch.MTermVectorsParams, callback: (error: any, response: any) => void): void {
        this.connection.mtermvectors(params, callback);
    }

    putScript(params: Elasticsearch.PutScriptParams, callback: (err: any, response: any, status: any) => void): void {
        this.connection.putScript(params, callback);
    }

    putTemplate(params: Elasticsearch.PutTemplateParams, callback: (err: any, response: any, status: any) => void): void {
        this.connection.putTemplate(params, callback);
    }

    reindex(params: Elasticsearch.ReindexParams, callback: (error: any, response: Elasticsearch.ReindexResponse) => void): void {
        this.connection.reindex(params, callback);
    }

    reindexRethrottle(params: Elasticsearch.ReindexRethrottleParams, callback: (error: any, response: any) => void): void {
        this.connection.reindexRethrottle(params, callback);
    }

    renderSearchTemplate(params: Elasticsearch.RenderSearchTemplateParams, callback: (error: any, response: any) => void): void {
        this.connection.renderSearchTemplate(params, callback);
    }

    scroll<T>(params: Elasticsearch.ScrollParams, callback: (error: any, response: Elasticsearch.SearchResponse<T>) => void): void {
        this.connection.scroll(params, callback);
    }

    search<T>(params: Elasticsearch.SearchParams, callback: (error: any, response: Elasticsearch.SearchResponse<T>) => void): void {
        this.connection.search(params, callback);
    }

    searchShards(params: Elasticsearch.SearchShardsParams, callback: (error: any, response: Elasticsearch.SearchShardsResponse) => void): void {
        this.connection.searchShards(params, callback);
    }

    searchTemplate(params: Elasticsearch.SearchTemplateParams, callback: (error: any, response: any) => void): void {
        this.connection.searchTemplate(params, callback);
    }

    suggest(params: Elasticsearch.SuggestParams, callback: (error: any, response: any) => void): void {
        this.connection.suggest(params, callback);
    }

    termvectors(params: Elasticsearch.TermvectorsParams, callback: (error: any, response: any) => void): void {
        this.connection.termvectors(params, callback);
    }

    update(params: Elasticsearch.UpdateDocumentParams, callback: (error: any, response: any) => void): void {
        this.connection.update(params, callback);
    }

    updateByQuery(params: Elasticsearch.UpdateDocumentByQueryParams, callback: (error: any, response: any) => void): void {
        this.connection.updateByQuery(params, callback);
    }

    close(): void {
        this.connection.close();
    }
}
