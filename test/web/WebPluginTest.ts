import { suite, test } from 'mocha-typescript';
import * as e from 'express';
import { mock, instance, verify, when } from 'ts-mockito';
import * as sinon from 'sinon';
import { OptionsV2 } from 'xml2js';
import { must } from 'must';
import * as xmlparser from 'express-xml-bodyparser';
import WebPlugin, { WebPluginOptions } from '../../src/web/WebPlugin';

class WebPluginTestHelper extends WebPlugin {
  regsiterXmlBodyParser(express: e.Express) {
    super.regsiterXmlBodyParser(express);
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
    webPlugin.regsiterXmlBodyParser(express);
    spiedExpress.calledOnce.must.be.true();
  }

  @test
  'disable xml body parser'() {
    const express: e.Express = e();
    const spiedExpress = sinon.spy(express, 'use');
    const webPlugin = new WebPluginTestHelper();
    webPlugin.regsiterXmlBodyParser(express);
    spiedExpress.calledOnce.must.be.false();
  }
}
