// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import { ElasticsearchClient } from './ElasticsearchClient';

export default class ElasticsearchPlugin implements Plugin {
    name = 'ElasticsearchPlugin';

    getName() {
        return this.name;
    }

    willStart(app: BaseApp) {
        if (!app.hasConfig('elasticsearch')) {
            throw new Error('ElasticsearchPlugin has been registered but could not find config using key "elasticsearch"');
        }

        const context = app.getContext();
        const confs = context.getConfig('elasticsearch');
        Object.keys(confs).forEach((key) => {
            const clientSingleton = new BaseSingletonDefinition<any>(ElasticsearchClient, key);
            clientSingleton.setPropertyByValue('name', key);
            clientSingleton.setPropertyByValue('configuration', confs[key]);
            context.registerSingletons(clientSingleton);
        });
    }
}
