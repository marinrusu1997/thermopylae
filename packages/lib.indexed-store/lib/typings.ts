import { Nullable, Undefinable } from '@thermopylae/core.declarations';

/**
 * Defines the property name of the primary key.
 */
const PK_INDEX_NAME = 'id';

/**
 * Name of the indexed property.
 */
type IndexName<Recordable> = Exclude<keyof Recordable, symbol | number> | string;

/**
 * Value of the indexed property.
 */
type IndexValue = Undefinable<Nullable<string | number>>;

/**
 * Index which contains documents indexed by a given property.
 */
type Index<Recordable> = Map<IndexValue, Array<Recordable>>;

/**
 * Repository which contains all index names, and their respective documents.
 */
type IndexRepo<Recordable> = Map<IndexName<Recordable>, Index<Recordable>>;

/**
 * Represents the contract that records have to implement in order to be indexable.
 */
interface Recordable extends Record<PropertyKey, any> {
	readonly [PK_INDEX_NAME]: IndexValue;
}

export { PK_INDEX_NAME, IndexName, IndexValue, Index, IndexRepo, Recordable };
