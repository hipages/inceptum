
global.Promise.prototype.finally = function(f) {
  // tslint:disable-next-line:no-invalid-this
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
        }),
    );
};

global.Promise.prototype.spread = function(f) {
  // tslint:disable-next-line:no-invalid-this
  return this.then((argArr) => f(...argArr));
};
