import * as mocha from 'mocha';
import { must } from 'must';
import { InceptumApp } from '../../src/app/InceptumApp';
import { JsonProvider } from '../../src/config/JsonProvider';

describe('ElasticsearchPlugin', () => {
    it('It must register a singleton if there\'s a config for elasticsearch', async () => {
        const myConfig = {
            elasticsearch: {
                elastic: {
                    hosts: [
                        {
                            host: 'localhost',
                            port: 9200,
                            protocol: 'http',
                        },
                    ],
                },
            },
        };
        const app = new InceptumApp({config: new JsonProvider(myConfig)});
        await app.start();
        const definition = app.getContext().getDefinitionByName('elastic');
        definition.must.not.be.undefined();
        definition.getName().must.be.equal('elastic');
        const client = await app.getContext().getObjectByName('elastic');
        const myConfig2 = client.getClientConfiguration();
        myConfig2.hosts.must.be.an.array();
        myConfig2.hosts[0].host.must.be.equal('localhost');
        await app.stop();
    });
    it('It must not register a singleton if there isn\'t a config for elasticsearch', async () => {
        const myConfig = {
            elastics: {},
        };
        const app = new InceptumApp({config: new JsonProvider(myConfig)});
        await app.start();
        try {
            app.getContext().getDefinitionByName('elastic');
            true.must.be.false();
        } catch (e) {
            e.must.be.an.error(/No object definition with name elastic registered in the context/);
        }
        await app.stop();
    });
});
