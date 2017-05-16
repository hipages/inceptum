
export interface ObjectDefinitionInspector {
  /**
   * Called for every object definition to be inspected.
   * It can modify the ObjectDefinition
   * @param objectDefinition ObjectDefinition The object definition to possibly modify
   * @return null or undefined if there's not change to be maded to the ObjectDefinition
   * or the new ObjectDefinition to use.
   */
  inspect(objectDefinition),
}
