import clone from 'lodash.clone';
import cloneDeep from 'lodash.clonedeep';

/**
 * Removes first occurrence of the item from array if exists
 *
 * @param {boolean|number|string}			item
 * @param {Array<boolean|number|string>}	array
 *
 * @return {boolean}
 */
function removeItemFromArray(item: boolean | number | string, array: Array<boolean | number | string>): boolean {
	const indexOfTheItem = array.indexOf(item);
	if (indexOfTheItem !== -1) {
		return array.splice(indexOfTheItem, 1).length === 1;
	}
	return false;
}

function isEmptyObject(obj: object): boolean {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

export { clone, cloneDeep, removeItemFromArray, isEmptyObject };
