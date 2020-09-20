/**
 * Generates random token of specified length
 *
 * @param length
 */
function generateToken(length: number): string {
	const CHARACTER_SET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
	const tokenCharacters = [];
	for (let tokenCharactersIndex = 0; tokenCharactersIndex < length; tokenCharactersIndex += 1) {
		const CHARACTER_SET_INDEX = Number((Math.random() * (CHARACTER_SET.length - 1)).toFixed(0));
		tokenCharacters[tokenCharactersIndex] = CHARACTER_SET[CHARACTER_SET_INDEX];
	}
	return tokenCharacters.join('');
}

export { generateToken };
