import { suite, test } from 'mocha-typescript';
// import { must } from 'must';
import { verify, mock, instance, capture } from 'ts-mockito';
import SwaggerMetadataMiddleware, { SwaggerMetadataMiddlewareConfig } from '../../src/swagger/SwaggerMetadataMiddleware';
import { ApiKeyVerification } from '../../src/swagger/ApiKeyVerification';
import { UnauthorizedError } from '../../src/web/errors/UnauthorizedError';

class CbClass {
  cb(obj?: any) {
    return;
  }
}

@suite
class ApiKeyVerificationTest {

  @test
  'Callback is called without Error object if config api key is equal to request api key'() {
    const apiKey = 'this-is-a-test-api-key';
    const verification = ApiKeyVerification.verifyApiKey('this-is-a-test-api-key');
    const mockedCb = mock(CbClass);
    const cbInstance = instance(mockedCb);
    verification('', '', 'this-is-a-test-api-key', cbInstance.cb);
    verify(mockedCb.cb()).once();
  }

  @test
  'Create an UnauthorizedError if config api key is different from request api key'() {
    const apiKey = 'this-is-a-test-api-key';
    const verification = ApiKeyVerification.verifyApiKey('this-is-a-test-api-key');
    const mockedCb = mock(CbClass);
    const cbInstance = instance(mockedCb);
    verification('', '', 'this-is-a-different-test-api-key', cbInstance.cb);
    verify(mockedCb.cb()).never();
    const [firstArg] = capture(mockedCb.cb).first();
    firstArg.must.be.an.instanceof(UnauthorizedError);
    firstArg.message.must.be.equal('Failed to authenticate using api key');
  }

  @test
  'Create an UnauthorizedError if apiKey is empty'() {
    const verification = ApiKeyVerification.verifyApiKey('');
    const mockedCb = mock(CbClass);
    const cbInstance = instance(mockedCb);
    verification('','', 'this-is-a-different-test-api-key', cbInstance.cb);
    verify(mockedCb.cb()).never();
    const [ue] = capture(mockedCb.cb).last();
    ue.must.be.an.instanceof(UnauthorizedError);
    ue.message.must.be.an.equal('Failed to set up an api key');
  }

}
