function isObject(item) {
	return typeof item === 'object' && !Array.isArray(item) && item !== null;
}

function notNull(value) {
	if (value == null) {
		throw new Error(`Value is ${value}`);
	}
	return value;
}

module.exports = {
	isObject,
	notNull
};
