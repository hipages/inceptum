// tslint:disable:prefer-function-over-method
import { get } from 'lodash';
import { ConfigAdapter } from './ConfigProvider';

export class JsonProvider implements ConfigAdapter {
  config: object;

  constructor(config) {
    this.config = config;
  }

  hasConfig(key: string): boolean {
    return Boolean(get(this.config, key));
  }

  getConfig(key: string, defaultValue?: any): any {
    return get(this.config, key) || defaultValue;
  }

}
