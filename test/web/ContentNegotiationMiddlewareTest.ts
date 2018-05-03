import { suite, test } from 'mocha-typescript';
import * as must from 'must';
import { mock, verify, instance, when, capture } from 'ts-mockito';
import { Request } from 'express';
import { ContentNegotiationMiddleware } from '../../src/web/ContentNegotiationMiddleware';

class DumbRequest {
  is(contentType: string): boolean {
    return false;
  }
  get(header: string): string {
    return undefined;
  }
}

class DumbResponse {
  header(name: string, value: string) {
    // do nothing
  }
  send(data: any) {
    // nothing
  }
}

@suite
class ContentNegotiationMiddlewareTest {

  @test
  'No xml root gives an empty middleware'() {
    const middlewareInstance = new ContentNegotiationMiddleware(undefined);
    must(middlewareInstance.getMiddleware()).be.undefined();
  }

  @test
  'If Accept is not xml, the send method is not overwritten'() {
    const middlewareInstance = new ContentNegotiationMiddleware('voucher');
    const middleware = middlewareInstance.getMiddleware();

    const dumbResponse = {send: 1};
    const mockedRequest = mock<DumbRequest>(DumbRequest);
    when(mockedRequest.is('application/xml')).thenReturn(false);
    const mockedRequestInstance = instance(mockedRequest);
    middleware(mockedRequestInstance, dumbResponse, () => {/* do nothin */});
    dumbResponse.send.must.equal(1);
    verify(mockedRequest.is('application/xml')).once();
    verify(mockedRequest.get('accept')).once();
  }

  @test
  'If Accept is xml, the send method is overwritten'() {
    const middlewareInstance = new ContentNegotiationMiddleware('voucher');
    const middleware = middlewareInstance.getMiddleware();

    const mockedRequest = mock<DumbRequest>(DumbRequest);
    const mockedResponse = mock<DumbResponse>(DumbResponse);

    when(mockedRequest.is('application/xml')).thenReturn(true);

    const mockedRequestInstance = instance(mockedRequest);
    const mockedResponseInstance = instance(mockedResponse);

    const originalSend = mockedResponse.send;

    middleware(mockedRequestInstance, mockedResponseInstance, () => {/* do nothin */});

    verify(mockedRequest.is('application/xml')).once();
    verify(mockedRequest.get('accept')).never();
    verify(mockedResponse.header('content-type', 'application/xml')).once();

    mockedResponseInstance.send({name: 'Paolo'});
    verify(originalSend('<?xml version="1.0"?><voucher><name>Paolo</name></voucher>')).once();
  }
}
