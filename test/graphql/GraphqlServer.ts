import { merge } from 'lodash';
import { InceptumApp, GraphqlPlugin, WebPlugin } from '../../src/index';
import { SchemaDefinition, RootQuery, Mutation, tradie, jobAssignment, job } from './TypeDefs';
import { tradieResolver, jobResolver, jobAssignmentResolver } from './Resolvers';

const createServer = () => {
    const app = new InceptumApp();
    const web = new WebPlugin();
    const graphqlPlugin = new GraphqlPlugin('/graphql', {
        typesDefs: [SchemaDefinition, RootQuery, Mutation, tradie, jobAssignment, job],
        resolvers: merge({}, tradieResolver, jobResolver, jobAssignmentResolver),
    });
    app.use(
        web,
        graphqlPlugin,
    );
    return app;
};

const server = createServer();
server.start();
