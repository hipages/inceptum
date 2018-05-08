import * as bp from 'body-parser';
import { Plugin } from '../app/BaseApp';
import WebPlugin from '../web/WebPlugin';
import SwaggerMetadataMiddleware, { SwaggerMetadataMiddlewareConfig } from './SwaggerMetadataMiddleware';
import SwaggerRouterMiddleware from './SwaggerRouterMiddleware';
import createCorsMiddlware from './CORSMiddleware';

export class SwaggerPlugin implements Plugin {
  private swaggerPath: string;

  constructor(swaggerPath) {
    this.swaggerPath = swaggerPath;
  }

  name = 'swagger-plugin';
  async willStart(app, context) {
    const express = context.get(WebPlugin.CONTEXT_APP_KEY);

    const CORSMiddleware = createCorsMiddlware({
      allowedOrigins: app.getConfig('app.cors.allowOrigin', '*'),
      allowedHeaders: app.getConfig('app.cors.allowHeaders', ['Content-type']),
      allowedMaxAge: app.getConfig('app.cors.maxAge', 300),
    });

    const apiKey = app.getConfig('app.apiKey', null);
    const mdConfig: SwaggerMetadataMiddlewareConfig = { apiKey, swaggerFilePath: this.swaggerPath };
    const meta = new SwaggerMetadataMiddleware(mdConfig);
    const router = new SwaggerRouterMiddleware(app.getContext());
    express.use(bp.json({ limit: '10mb' }));
    express.use(bp.urlencoded({ extended: true }));
    await meta.register(express);
    express.use(CORSMiddleware);
    await router.register(express);
  }
}
