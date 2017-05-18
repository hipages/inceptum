
global.Promise.prototype.finally = function (f) {
  return this.then(
    (r) =>
      f()
        .then(() => r),
    (r) =>
      f()
        .then(() => {
          throw r;
        }, () => {
          throw r;
        })
    );
};

global.Promise.prototype.spread = function (f) {
  return this.then((argArr) => f(...argArr));
};
