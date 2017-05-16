
export abstract class PromiseUtil {
  static try(f) {
    return new Promise((resolve, reject) => {
      try {
        resolve(f());
      } catch (e) {
        reject(e);
      }
    });
  }
  static map(arr: any[], f: (this: void, value: any, index: number, array: any[]) => any): Promise<any[]> {
    return Promise.all(arr.map(f));
  }
  static mapSeries(arr, f) {
    let p = Promise.resolve();
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

