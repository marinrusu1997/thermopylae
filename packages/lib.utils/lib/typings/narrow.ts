function narrow<T extends string | number, R extends T>(_from: T, _to: R): asserts _from is R {
	return;
}

function narrowUnion<T extends string | number, R extends T>(_from: T): asserts _from is R {
	return;
}

export { narrow, narrowUnion };
