const { ObjectDefinition } = require('../../../src/ioc/objectdefinition/ObjectDefinition');
const demand = require('must');

class A {}

describe('ioc/objectdefinition/ObjectDefinition', () => {
  describe('Remains abstract', () => {
    it('getInstance is abstract', function* () {
      const objectDefinition = new ObjectDefinition(A);
      try {
        yield objectDefinition.getInstance();
      } catch (e) {
        e.must.be.an.error('Unimplemented');
      }
    });
  });
  describe('Copy', () => {
    const objectDefinition = new ObjectDefinition(A);
    objectDefinition.setAutowireCandidate(false);
    const copy = objectDefinition.copy();
    it('copy gives another instance', () => {
      copy.a = 1;
      demand(objectDefinition.a).is.undefined();
    });
    it('copy gives an object definition with the same base properties', () => {
      copy.isLazy().must.equal(objectDefinition.isLazy());
      copy.isAutowireCandidate().must.equal(objectDefinition.isAutowireCandidate());
    });
    it('context is not copied on copy', () => {
      demand(copy.getContext()).is.null();
    });
  });
});
