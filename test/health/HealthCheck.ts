import { must } from 'must';
import { suite, test } from 'mocha-typescript';
import { mock, when, anything, verify, instance } from 'ts-mockito';
import { MysqlHealthCheck } from '../../src/mysql/MysqlHealthCheck';
import { MysqlClient } from '../../src/mysql/MysqlClient';
import { HealthCheckStatus, HealthCheckGroup, HealthCheck, HealthCheckResult } from '../../src/health/HealthCheck';

suite('health/HealthCheck', () => {
  suite('HealthCheckGroup', () => {
    suite('Grouping', () => {
      test('adding simple test adds it directly', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('simpleId');
        group.addCheck(instance(mockHealthCheck));
        group.healthChecks.size.must.equal(1);
        Array.from(group.healthChecks.keys()).must.eql(['simpleId']);
      });
      test('adding 2nd level test adds it to a group', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('simpleId.subtest');
        group.addCheck(instance(mockHealthCheck));
        group.healthChecks.size.must.equal(1);
        Array.from(group.healthChecks.keys()).must.eql(['simpleId']);
        const simpleIdGroup = group.healthChecks.get('simpleId');
        simpleIdGroup.must.be.instanceOf(HealthCheckGroup);
        const asGroup = simpleIdGroup as HealthCheckGroup;
        asGroup.healthChecks.size.must.equal(1);
        Array.from(asGroup.healthChecks.keys()).must.eql(['subtest']);
      });
      test('adding 2 2nd level tests adds it to the subgroup', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('simpleId.subtest');
        group.addCheck(instance(mockHealthCheck));

        const mockHealthCheck2 = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck2.getCheckName()).thenReturn('simpleId.subtest2');
        group.addCheck(instance(mockHealthCheck2));

        group.healthChecks.size.must.equal(1);
        Array.from(group.healthChecks.keys()).must.eql(['simpleId']);
        const simpleIdGroup = group.healthChecks.get('simpleId');
        simpleIdGroup.must.be.instanceOf(HealthCheckGroup);
        const asGroup = simpleIdGroup as HealthCheckGroup;
        asGroup.healthChecks.size.must.equal(2);
        Array.from(asGroup.healthChecks.keys()).must.eql(['subtest', 'subtest2']);
      });
      test('adding 3rd level test adds it to a sub-subgroup', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('simpleId.subtest.subsubtest');
        group.addCheck(instance(mockHealthCheck));
        group.healthChecks.size.must.equal(1);
        Array.from(group.healthChecks.keys()).must.eql(['simpleId']);
        const simpleIdGroup = group.healthChecks.get('simpleId');
        simpleIdGroup.must.be.instanceOf(HealthCheckGroup);
        const asGroup = simpleIdGroup as HealthCheckGroup;
        asGroup.healthChecks.size.must.equal(1);
        Array.from(asGroup.healthChecks.keys()).must.eql(['subtest']);

        const simpleIdGroup2 = asGroup.healthChecks.get('subtest');
        simpleIdGroup2.must.be.instanceOf(HealthCheckGroup);
        const asGroup2 = simpleIdGroup2 as HealthCheckGroup;
        asGroup2.healthChecks.size.must.equal(1);
        Array.from(asGroup2.healthChecks.keys()).must.eql(['subsubtest']);
      });
    });
    suite('Lifecycle', () => {
      test('starting the group starts the checks', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('simpleId');
        group.addCheck(instance(mockHealthCheck));
        group.start();
        verify(mockHealthCheck.start()).once();
        group.stop();
      });
      test('stopping the group stops the checks', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('simpleId');
        group.addCheck(instance(mockHealthCheck));
        group.start();
        verify(mockHealthCheck.start()).once();
        group.stop();
        verify(mockHealthCheck.stop()).once();
      });
    });
    suite('Result', () => {
      test('all checks OK gives OK', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('check1');
        when(mockHealthCheck.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.OK, 'OK'));

        const mockHealthCheck2 = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck2.getCheckName()).thenReturn('check2');
        when(mockHealthCheck2.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.OK, 'OK'));

        group.addCheck(instance(mockHealthCheck));
        group.addCheck(instance(mockHealthCheck2));
        group.start();
        const result = group.getLastResult();
        result.status.must.equal(HealthCheckStatus.OK);
        group.stop();
      });
      test('a test in not ready makes the result non-ready', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('check1');
        when(mockHealthCheck.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.OK, 'OK'));

        const mockHealthCheck2 = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck2.getCheckName()).thenReturn('check2');
        when(mockHealthCheck2.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.NOT_READY, 'Not ready'));

        group.addCheck(instance(mockHealthCheck));
        group.addCheck(instance(mockHealthCheck2));
        group.start();
        const result = group.getLastResult();
        result.status.must.equal(HealthCheckStatus.NOT_READY);
        result.message.must.equal('Check check2 returned NOT_READY');
        group.stop();
      });
      test('a test in not ready and one warning makes the result warning', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('check1');
        when(mockHealthCheck.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.WARNING, 'Warning'));

        const mockHealthCheck2 = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck2.getCheckName()).thenReturn('check2');
        when(mockHealthCheck2.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.NOT_READY, 'Not ready'));

        group.addCheck(instance(mockHealthCheck));
        group.addCheck(instance(mockHealthCheck2));
        group.start();
        const result = group.getLastResult();
        result.status.must.equal(HealthCheckStatus.WARNING);
        result.message.must.equal('Check check1 returned WARNING');
        group.stop();
      });
      test('a subtest in warning makes the result warning', () => {
        const group = new HealthCheckGroup('test1');
        const mockHealthCheck = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck.getCheckName()).thenReturn('main.check1');
        when(mockHealthCheck.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.WARNING, 'Warning'));

        const mockHealthCheck2 = mock<HealthCheck>(HealthCheck);
        when(mockHealthCheck2.getCheckName()).thenReturn('main.check2');
        when(mockHealthCheck2.getLastResult()).thenReturn(new HealthCheckResult(HealthCheckStatus.OK, 'OK'));

        group.addCheck(instance(mockHealthCheck));
        group.addCheck(instance(mockHealthCheck2));
        group.start();
        const result = group.getLastResult();
        result.status.must.equal(HealthCheckStatus.WARNING);
        result.message.must.equal('Check Group: main returned WARNING');
        group.stop();
      });
    });
  });
});
