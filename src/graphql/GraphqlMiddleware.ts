import * as fs from 'fs';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLError, Source } from 'graphql';

export class GraphqlBase {
    /**
     * The type definition defining the operations or
     * should say queries available in graphql
     */
    typesDefs: Array<string>;
    /**
     * The resolved methods against each query
     */
    resolvers: object;
    /**
     * The schema object for graphQl
     */
    schema?: object;
    /**
     * The file path for the graphql if schema is not provided
     */
    graphqlFilePath?: string;
    /**
     * if set to true, GraphQL endpoint is loaded in a browser
     */
    graphiql?: boolean;
    /**
     * A value to pass as the rootValue to the graphql() function from GraphQL.js/src/execute.js
     */
    rootValue: any;
    /**
     * function which will be used to format any errors produced by fulfilling a GraphQL operation
     * If no function is provided, GraphQL's default spec-compliant formatError function will be used
     */
    formatError?: any;
    /**
     *  A value to pass as the context to the graphql() function from GraphQL.js/src/execute.js
     */
    context?: any;
    /**
     * An optional function for adding additional metadata to the GraphQL response as a key - value object.
     */
    extensions?: any;
    /**
     * Optional additional validation rules queries must satisfy in addition to those defined by graphQL spec
     */
    validationRules?: any;
}

// this is where we do the ground work for creating the server
/**
 * Building types
 * Builing root queries
 * Building resolvers
 * adding loggers
 * Error format function
 */
export class GraphqlMiddleware extends GraphqlBase {
    graphqlConfig: GraphqlBase;
    formatError: any;

    constructor(graphqlConfig: any) {
        super();
        this.graphqlConfig = graphqlConfig;
    }

    /**
     * Produces a GraphQLError representing a syntax error, containing useful
     * descriptive information about the syntax error's position in the source.
     */
    syntaxError(
        source: Source,
        position: number,
        description: string,
    ): GraphQLError {
        return new GraphQLError(`Syntax Error: ${description}`, undefined, source, [
            position,
        ]);
    }
    /**
     * Produces a executible schema with resolver function to be pased to graphql server for translation
     */
    executableSchema() {
        return makeExecutableSchema({
            typeDefs: this.graphqlConfig.typesDefs,
            resolvers: this.graphqlConfig.resolvers,
        });
    }
}
