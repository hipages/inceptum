const { ObjectDefinitionInspector } = require('../../src/ioc/ObjectDefinitionInspector');

describe('Object definition inspector', () => {
  it('remains abstract', () => {
    try {
      new ObjectDefinitionInspector().inspect(null);
    } catch (e) {
      e.must.be.an.error();
    }
  });
});
