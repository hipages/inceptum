import { suite, test } from 'mocha-typescript';
import * as e from 'express';
import { mock, instance, verify, when } from 'ts-mockito';
import * as sinon from 'sinon';
import { OptionsV2 } from 'xml2js';
import { must } from 'must';
import * as xmlparser from 'express-xml-bodyparser';
import WebPlugin, { WebPluginOptions } from '../../src/web/WebPlugin';

class WebPluginTestHelper extends WebPlugin {
  registerXmlBodyParser(express: e.Express) {
    super.registerXmlBodyParser(express);
  }

  registerXmlContentNegotiationMiddleware(express: e.Express, xmlRoot: string) {
    super.registerXmlContentNegotiationMiddleware(express, xmlRoot);
  }
}

@suite
class WebPluginTest {

  @test
  'enable xml body parser'() {
    const xmlBpOptions: OptionsV2 = {
      explicitArray: false,
    };
    const webPluginOptions: WebPluginOptions = {
      xmlBodyParserOptions: xmlBpOptions,
    };
    const express: e.Express = e();
    const spiedExpress = sinon.spy(express, 'use');
    const webPlugin = new WebPluginTestHelper(webPluginOptions);
    webPlugin.registerXmlBodyParser(express);
    spiedExpress.calledOnce.must.be.true();
  }

  @test
  'disable xml body parser'() {
    const express: e.Express = e();
    const spiedExpress = sinon.spy(express, 'use');
    const webPlugin = new WebPluginTestHelper();
    webPlugin.registerXmlBodyParser(express);
    spiedExpress.calledOnce.must.be.false();
  }

  @test
  'no xml content negotiation middleware'() {
    const express: e.Express = e();
    const spiedExpress = sinon.spy(express, 'use');
    const webPlugin = new WebPluginTestHelper();
    webPlugin.registerXmlContentNegotiationMiddleware(express, '');
    spiedExpress.calledOnce.must.be.false();
  }

  @test
  'register xml content negotiation middleware'() {
    const express: e.Express = e();
    const spiedExpress = sinon.spy(express, 'use');
    const webPlugin = new WebPluginTestHelper();
    webPlugin.registerXmlContentNegotiationMiddleware(express, 'voucher');
    spiedExpress.calledOnce.must.be.true();
  }
}
