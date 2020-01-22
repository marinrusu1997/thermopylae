/**
 * Replaces the string at a given position with another one.
 *
 * @param replacement	The replacement
 * @param index			Starting index from where replacement needs to be done
 * @param string		Initial string
 */
function replaceAt(replacement: string, index: number, string: string): string {
	return string.substr(0, index) + replacement + string.substr(index + replacement.length);
}

/**
 * Generates random string. Generation can be controlled via regular expressions.
 *
 * @param length				Length of the generated string
 * @param allowedCharRegex		Allowed chars that will be included in generated string
 * @param headsRegex			Regex for allowed chars on the begin and end of string.
 */
function generateString(length: number, allowedCharRegex?: RegExp, headsRegex?: RegExp): string {
	let result = '';
	const alphaNumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const specialChars = ' !"#$%&\'()*+,-./:;<=>?@[]^_`{|}~';
	let i = 0;
	let testRegex: RegExp | undefined;
	while (i < length) {
		const charSet = Math.random() < 0.5 ? alphaNumeric : specialChars;
		const selectedChar = charSet.charAt(Math.floor(Math.random() * charSet.length));

		if (headsRegex && (i === 0 || i === length - 1)) {
			testRegex = headsRegex;
		} else {
			testRegex = allowedCharRegex;
		}

		if (testRegex) {
			if (testRegex.test(selectedChar)) {
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

export { replaceAt, generateString };
