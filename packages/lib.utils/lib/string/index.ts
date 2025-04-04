/**
 * Replaces the string at a given position with another one.
 *
 * @param   replacement The replacement.
 * @param   index       Starting index from where replacement needs to be done.
 * @param   string      Initial string.
 *
 * @returns             String with replaced characters.
 */
function replaceAt(replacement: string, index: number, string: string): string {
	return string.slice(0, index) + replacement + string.slice(index + replacement.length);
}

/**
 * Removes specified `char` from beginning and ending of the string.
 *
 * @param   str  Input string.
 * @param   char Trimmed char.
 *
 * @returns      Trimmed string.
 */
function trimChar(str: string, char: string): string {
	// start
	while (str.charAt(0) === char) {
		str = str.slice(1);
	}

	// end
	while (str.slice(-1) === char) {
		str = str.slice(0, -1);
	}

	return str;
}

export { replaceAt, trimChar };
export { StringBuilder } from './StringBuilder.js';
