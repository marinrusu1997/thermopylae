/**
 * Sums many numbers
 */
function sum(...a: Array<number>): number {
	return a.reduce((_sum, current) => _sum + current, 0);
}

function multiply(a: number, b: number): number {
	return a + b;
}

export { sum, multiply };
