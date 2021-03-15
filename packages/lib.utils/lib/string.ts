import { randomElement } from './array';

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
 * @link random
 * @private
 */
const CHARSETS = [
	'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // Alpha Capitalized
	'abcdefghijklmnopqrstuvwxyz', // Alpha Non-capitalized
	'0123456789', // Numbers
	' !"#$%&\'()*+,-./:;<=>?@[]^_`{|}~' // Special Chars
];

interface RandomStringOptions {
	/**
	 * Length of the generated string. <br/>
	 * Default is 10.
	 */
	length: number;
	/**
	 * Allowed chars that will be included in generated string. <br/>
	 * Default is all characters.
	 */
	allowedCharRegex: RegExp;
}

/**
 * @link random
 * @private
 */
const DEFAULT_STR_GEN_OPTS = {
	length: 10,
	allowedCharRegex: /./
};

/**
 * Generates non-cryptographically strong random string.
 * Generation can be controlled via regular expressions.
 *
 * @param [options]		String generation options.
 *
 * @returns Generated string.
 */
function random(options?: Partial<RandomStringOptions>): string {
	if (options == null) {
		options = DEFAULT_STR_GEN_OPTS;
	} else {
		if (!options.length) {
			// implicit validation for values <= 0
			options.length = DEFAULT_STR_GEN_OPTS.length;
		}
		if (options.allowedCharRegex == null) {
			options.allowedCharRegex = DEFAULT_STR_GEN_OPTS.allowedCharRegex;
		}
	}

	let i = 0;
	let charSet;
	let selectedChar;

	const result = new Array(options.length);

	while (i < options.length!) {
		charSet = randomElement(CHARSETS);
		selectedChar = charSet.charAt(Math.floor(Math.random() * charSet.length));

		if (options.allowedCharRegex!.test(selectedChar)) {
			result[i] = selectedChar;
			i += 1;
		}
	}

	return result.join('');
}

/**
 * Removes specified `char` from beginning and ending of the string.
 *
 * @param str	Input string.
 * @param char	Trimmed char.
 *
 * @returns 	Trimmed string.
 */
function trimChar(str: string, char: string): string {
	// start
	while (str.charAt(0) === char) {
		str = str.substr(1);
	}

	// end
	while (str.slice(-1) === char) {
		str = str.slice(0, -1);
	}

	return str;
}

export { replaceAt, random, trimChar, RandomStringOptions };
