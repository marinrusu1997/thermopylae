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

export { replaceAt };
