export function Executor(fn: Function, timeout: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let _timeout = null;

    try {
      let expectPromise = fn();
      if (expectPromise && expectPromise.then) {
        _timeout = setTimeout(function () {
          reject(new Error('Timeout occurred! value: ' + timeout));
        }, timeout);

        await expectPromise;
      }
    } catch (e) {
      reject(e);
    }

    clearTimeout(_timeout!);

    resolve();
  });
}