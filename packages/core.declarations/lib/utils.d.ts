import { PromiseReject, PromiseResolve } from './functions';

export interface PublicPrivateKeys {
	readonly private: string | Buffer;
	readonly public: string | Buffer;
}

export interface PromiseHolder<T> {
	promise: Promise<T>;
	resolve: PromiseResolve<T>;
	reject: PromiseReject;
}
