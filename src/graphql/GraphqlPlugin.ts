import * as e from 'express';
import * as graphqlHTTP from 'express-graphql';
import BaseApp, { Plugin, PluginContext } from '../app/BaseApp';
import { AutowireGroup, Lazy, StartMethod, StopMethod } from '../ioc/Decorators';
import { LogManager } from '../log/LogManager';
import WebPlugin from '../web/WebPlugin';
import { GraphqlMiddleware, GraphqlBase } from './GraphqlMiddleware';

export const GRAPHQL_GROUP = 'inceptum:graphql';

class GraphqlPluginManager {
    /**
     * format error in more readable form
     * @param error
     */
    formatError(error) {
        return {
            message: error.message,
            locations: error.locations,
            stack: error.stack ? error.stack.split('\n') : [],
            path: error.path,
        };
    }
    /**
     * create a new instance for graphql server
     * @param middleware
     * @param pluginContext
     */
    getGraphqlHTTP(middleware: GraphqlMiddleware, pluginContext: PluginContext) {
        return graphqlHTTP((req) => ({
            schema: middleware.executableSchema(),
            graphiql: true,
            formatError: this.formatError,
            context: pluginContext, // context is where you can pass
        }));
    }
}

export default class GraphqlPlugin implements Plugin {
    graphqlConfig: GraphqlBase;
    rootPath: string;
    name = 'GraphqlPlugin';

    constructor(rootPath: string, graphqlConfig: any) {
        this.graphqlConfig = graphqlConfig;
        this.rootPath = rootPath;
    }
    /**
     * Return the name of this plugin
     */
    getName() {
        return this.name;
    }
    /**
     * bootstrap the graphql server
     * @param app
     * @param pluginContext
     */
    willStart(app: BaseApp, pluginContext: PluginContext) {
        const context = app.getContext();
        const express: e.Express = pluginContext.get(WebPlugin.CONTEXT_APP_KEY);
        const graphQlMiddleware = new GraphqlMiddleware(this.graphqlConfig);
        const graphQlPluginManager = new GraphqlPluginManager();
        if (express) {
            // express.use(this.rootPath, this.getGraphqlHTTP() );
            express.use(this.rootPath, graphQlPluginManager.getGraphqlHTTP(graphQlMiddleware, pluginContext));
        }
    }
}
