// Test...
const { AbstractObjectDefinitionInspector } = require('../../src/ioc/AbstractObjectDefinitionInspector');
const { BaseSingletonDefinition } = require('../../src/ioc/objectdefinition/BaseSingletonDefinition');

class A {
}

class B {}

class MyInspector extends AbstractObjectDefinitionInspector {
  doInspect(objectDefinition) {  // eslint-disable-line no-unused-vars
    return 'inspected';
  }
}

const singletonDefinitionA = new BaseSingletonDefinition(A);
const singletonDefinitionB = new BaseSingletonDefinition(B);

describe('ioc/autoconfig/AbstractObjectDefinitionInspector', () => {
  describe('Is abstract', () => {
    it('throws an exception on method doInspect', () => {
      try {
        new AbstractObjectDefinitionInspector().doInspect(null);
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error();
      }
    });
  });
  describe('Interest criteria', () => {
    it('is not interested in anything by default', () => {
      const inspector = new AbstractObjectDefinitionInspector();
      inspector.interestedIn(singletonDefinitionA).must.be.false();
    });
    it('is interested in the right class', () => {
      const inspector = new AbstractObjectDefinitionInspector();
      inspector.addInterestedClass(A);
      inspector.interestedIn(singletonDefinitionA).must.be.true();
      inspector.interestedIn(singletonDefinitionB).must.be.false();
    });
    it('is interested in objects of the right name', () => {
      const inspector = new AbstractObjectDefinitionInspector();
      inspector.addNamePattern('A');
      inspector.interestedIn(singletonDefinitionA).must.be.true();
      inspector.interestedIn(singletonDefinitionB).must.be.false();
    });
    it('is interested in objects of the right name (regexp)', () => {
      const inspector = new AbstractObjectDefinitionInspector();
      inspector.addNamePattern(/A/);
      inspector.interestedIn(singletonDefinitionA).must.be.true();
      inspector.interestedIn(singletonDefinitionB).must.be.false();
    });
    it('is interested in everything if told to', () => {
      const inspector = new AbstractObjectDefinitionInspector();
      inspector.setInspectAll(true);
      inspector.interestedIn(singletonDefinitionA).must.be.true();
      inspector.interestedIn(singletonDefinitionB).must.be.true();
    });
  });
  describe('Calls inspect', () => {
    it('Calls inspect method if interested', () => {
      const myInspector = new MyInspector();
      myInspector.setInspectAll(true);
      myInspector.inspect(singletonDefinitionA).must.be.equal('inspected');
    });
  });
});
