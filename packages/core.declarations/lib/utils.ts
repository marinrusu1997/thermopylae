import type { PromiseReject, PromiseResolve } from './functions.js';

interface PublicPrivateKeys {
	readonly private: string | Buffer;
	readonly public: string | Buffer;
}

interface PromiseHolder<T> {
	promise: Promise<T>;
	resolve: PromiseResolve<T>;
	reject: PromiseReject;
}

export type { PublicPrivateKeys, PromiseHolder };
