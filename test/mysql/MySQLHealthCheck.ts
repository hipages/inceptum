import { must } from 'must';
import { suite, test } from 'mocha-typescript';
import { mock, when, anything, verify, instance } from 'ts-mockito';
import { MySQLHealthCheck } from '../../src/mysql/MysqlHealthCheck';
import { MySQLClient } from '../../src/mysql/MysqlClient';
import { HealthCheckStatus } from '../../src/health/HealthCheck';

suite('mysql/MysqlHealthCheck', () => {
  test('Readonly flag is passed (true)', async () => {
    const check = new MySQLHealthCheck('testCheck', true);
    const mockedMysqlClient = mock(MySQLClient);
    when(mockedMysqlClient.ping(anything())).thenReturn(Promise.resolve(undefined));
    check.mysqlClient = instance(mockedMysqlClient);
    await check.doCheck();
    verify(mockedMysqlClient.ping(true)).once();
  });
  test('Readonly flag is passed (false)', async () => {
    const check = new MySQLHealthCheck('testCheck', false);
    const mockedMysqlClient = mock(MySQLClient);
    when(mockedMysqlClient.ping(anything())).thenReturn(Promise.resolve(undefined));
    check.mysqlClient = instance(mockedMysqlClient);
    await check.doCheck();
    verify(mockedMysqlClient.ping(false)).once();
  });
  test('OKs on success', async () => {
    const check = new MySQLHealthCheck('testCheck', false);
    const mockedMysqlClient = mock(MySQLClient);
    when(mockedMysqlClient.ping(anything())).thenReturn(Promise.resolve(undefined));
    check.mysqlClient = instance(mockedMysqlClient);
    await check.runCheck();
    const result = check.getLastResult();
    result.status.must.equal(HealthCheckStatus.OK);
  });
  test('CRITICAL on exception', async () => {
    const check = new MySQLHealthCheck('testCheck', false);
    const mockedMysqlClient = mock(MySQLClient);
    when(mockedMysqlClient.ping(anything())).thenThrow(new Error('Error'));
    check.mysqlClient = instance(mockedMysqlClient);
    await check.runCheck();
    const result = check.getLastResult();
    result.status.must.equal(HealthCheckStatus.CRITICAL);
  });
});
