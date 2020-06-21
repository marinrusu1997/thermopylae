
let resolve, reject;
const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
});

(async () => {
    const res = await Promise.all([
        promise,
        promise,
        promise,
        promise
    ]);
    console.log(res);
})();

setTimeout(() => resolve('It works!'), 2000);
