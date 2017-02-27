const { ObjectDefinitionInspector } = require('../../src/ioc/ObjectDefinitionInspector');

describe('ioc/ObjectDefinitionInspector', () => {
  it('remains abstract', () => {
    try {
      new ObjectDefinitionInspector().inspect(null);
    } catch (e) {
      e.must.be.an.error();
    }
  });
});
