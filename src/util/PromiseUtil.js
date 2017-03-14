
class PromiseUtil {
  static try(f) {
    return new Promise((resolve, reject) => {
      try {
        resolve(f());
      } catch (e) {
        reject(e);
      }
    });
  }
  static map(arr, f) {
    return Promise.all(arr.map((e) => f(e)));
  }
  static mapSeries(arr, f) {
    let p = Promise.resolve([]);
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const index = i;
      p = p.then(() => f(arr[i]))
        .then((res) => {
          result[index] = res;
        });
    }
    return p.then(() => result);
  }
}

module.exports = { PromiseUtil };
