import type { Document } from 'mongoose';

function fromDocument<T>(document: Document): T {
	const model = document.toObject({ virtuals: true }) as unknown as T & {
		_id?: string;
		__v?: string;
	};

	delete model._id;
	delete model.__v;

	return model;
}

export { fromDocument };
