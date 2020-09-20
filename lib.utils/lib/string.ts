/**
 * Replaces the string at a given position with another one.
 *
 * @param replacement	The replacement.
 * @param index			Starting index from where replacement needs to be done.
 * @param string		Initial string.
 *
 * @returns	String with replaced characters.
 */
function replaceAt(replacement: string, index: number, string: string): string {
	return string.substr(0, index) + replacement + string.substr(index + replacement.length);
}

/**
 * Generates random string.
 * Generation can be controlled via regular expressions.
 *
 * @param length				Length of the generated string.
 * @param allowedCharRegex		Allowed chars that will be included in generated string.
 *
 * @returns Generated string.
 */
function ofLength(length: number, allowedCharRegex?: RegExp): string {
	let result = '';
	const alphaNumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const specialChars = ' !"#$%&\'()*+,-./:;<=>?@[]^_`{|}~';
	let i = 0;
	while (i < length) {
		const charSet = Math.random() < 0.5 ? alphaNumeric : specialChars;
		const selectedChar = charSet.charAt(Math.floor(Math.random() * charSet.length));

		if (allowedCharRegex) {
			if (allowedCharRegex.test(selectedChar)) {
				result += selectedChar;
				i += 1;
			}
		} else {
			result += selectedChar;
			i += 1;
		}
	}
	return result;
}

/**
 * Removes trailing and ending dots from the string.
 *
 * @param str	Input string.
 *
 * @returns Trimmed string.
 */
function trimDots(str: string): string {
	// start
	while (str.charAt(0) === '.') {
		str = str.substr(1);
	}

	// end
	while (str.slice(-1) === '.') {
		str = str.slice(0, -1);
	}

	return str;
}

export { replaceAt, ofLength, trimDots };
