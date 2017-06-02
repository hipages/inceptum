

const original = Error['prepareStackTrace'];

global.Error['prepareStackTrace'] = (error, structuredStackTrace) => {
  error.structuredStackTrace = structuredStackTrace;
  return original(error, structuredStackTrace);
};
