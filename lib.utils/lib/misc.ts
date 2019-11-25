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

export { clone, cloneDeep, removeItemFromArray };
