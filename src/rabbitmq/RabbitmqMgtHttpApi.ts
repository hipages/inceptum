import Axios, { AxiosResponse } from 'axios';
import { AutowireConfig } from '../ioc/Decorators';
import { RabbitmqClientConfig } from './RabbitmqConfig';

export interface RabbitmqNodeHealthCheckResult {
  status: string,
  reason?: string,
}

export class RabbitmqMgtHttpApi {
  @AutowireConfig('rabbitmq.client')
  rabbitmqConfig: RabbitmqClientConfig;

  /**º
   * Runs basic healthchecks in the current node
   */
  async ping(): Promise<RabbitmqNodeHealthCheckResult> {
    try {
      const url = 'healthchecks/node';
      const res = await this.sendRequest('get', url);
      if (res.status !== 200) {
        throw new Error(`${url} returns status: (${res.status}, ${res.statusText})`);
      }
      const result: RabbitmqNodeHealthCheckResult = {...res.data};
      return Promise.resolve<RabbitmqNodeHealthCheckResult>(result);
    } catch (err) {
      throw err;
    }
  }

  protected sendRequest(method, url, params?): Promise<AxiosResponse> {
    return Axios.request({
      method,
      baseURL: `${this.rabbitmqConfig.mgtHttpTheme}://${this.rabbitmqConfig.mgtHttpHost}:${this.rabbitmqConfig.mgtHttpPort}/api/`,
      url,
      params,
      headers: {'content-type': 'application/json'},
      auth: {
        username: this.rabbitmqConfig.username,
        password: this.rabbitmqConfig.password,
      },
    });
  }
}

