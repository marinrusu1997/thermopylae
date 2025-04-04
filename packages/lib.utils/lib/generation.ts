function differentFrom<T>(originalValue: T, generator: () => T): T {
	let newValue = generator();
	while (newValue === originalValue) {
		newValue = generator();
	}
	return newValue;
}

export { differentFrom };
