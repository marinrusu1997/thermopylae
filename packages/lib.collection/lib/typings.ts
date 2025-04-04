import type { QueryConditions } from '@b4dnewz/mongodb-operators';
import type { Cloneable, UnaryPredicate } from '@thermopylae/core.declarations';
import { type IndexValue, PK_INDEX_NAME, type Recordable } from '@thermopylae/lib.indexed-store';

/** Top level string key of document. */
type KeyOf<Document> = Exclude<keyof Document, symbol | number>;

/** Indexed key of document. Can be expressed in dot notation for nested keys. */
type IndexedKey<Document> = KeyOf<Document> | string;

/**
 * Sort order for found documents. <br> Documents will be sorted by specified fields, in the order
 * they appear as keys in the object. <br>
 *
 * @example
 * 	<pre><code>// Sorts ascending by `firstName`, then descending by `birthYear`.
 * 	const sortFields = {
 * 	firstName: {@link SortDirection.ASCENDING},
 * 	birthYear: {@link SortDirection.DESCENDING}
 * 	};
 * 	</code></pre>
 */
type SortFields<Document> = Record<IndexedKey<Document>, SortDirection>;

/**
 * Represents the query for documents, and can take one of the values:
 *
 * Value type | Query behaviour ---------------- | ------------- IndexValue | Search documents by
 * their primary key. QueryConditions | Search documents by
 * [mongoose]{@link https://mongoosejs.com/docs/2.7.x/docs/query.html} schema.<br>Only a limited
 * subset of operators are [supported]{@link QueryOperators}. UnaryPredicate | Search documents by
 * predicate function.
 */
type Query<Document extends {}> = IndexValue | QueryConditions<Document> | UnaryPredicate<Document>;

/** Sorting direction for document field. */
const enum SortDirection {
	ASCENDING = 'asc',
	DESCENDING = 'desc'
}

/** [Supported query operators]{@link https://github.com/zipscene/common-query#supported-operators}. */
const enum QueryOperators {
	AND = '$and',
	OR = '$or',
	NOR = '$nor',
	EXISTS = '$exists',
	NOT = '$not',
	ELEM_MATCH = '$elemMatch',
	IN = '$in',
	NOT_IN = '$nin',
	ALL = '$all',
	SIZE = '$size',
	TEXT = '$text',
	REGEX = '$regex',
	GREATER = '$gt',
	GREATER_OR_EQUAL = '$gte',
	LESS = '$lt',
	LESS_OR_EQUAL = '$lte',
	NOT_EQUAL = '$ne',
	WILDCARD = '$wildcard'
}

/** [Supported update operators]{@link https://github.com/zipscene/common-query#supported-operators}. */
const enum UpdateOperators {
	SET = '$set',
	UNSET = '$unset',
	INC = '$inc',
	MUL = '$mul',
	RENAME = '$rename',
	MIN = '$min',
	MAX = '$max',
	ADD_TO_SET = '$addToSet',
	PUSH = '$push',
	POP = '$pop'
}

/** Projection type for a set of fields. */
const enum ProjectionType {
	/** Specifies the exclusion of a field. */
	EXCLUDE,
	/** Specifies the inclusion of a field. */
	INCLUDE
}

/**
 * Determines which fields are returned in the matching documents. <br> Projection is applied on
 * document clones.
 */
interface Projection<Document> {
	/** Projection type. Applies to all {@link Projection.fields}. */
	type: ProjectionType;
	/** Document fields that need to be projected. */
	fields: Array<IndexedKey<Document>>;
}

/** Represents an indexed property of the document. */
interface IndexedProperty<Document> {
	/** Property name. */
	name: IndexedKey<Document>;
	/** Property value. */
	value?: IndexValue;
}

/** Index options when searching for documents. */
interface IndexOptions<Document> {
	/**
	 * Determines on which index to perform search.<br> When {@link IndexedProperty.value} is given,
	 * will perform search only on documents having {@link IndexedProperty.name} equal to that
	 * value.
	 */
	index: IndexedProperty<Document>;
}

/** Options for documents searching. */
interface FindOptions<Document> extends IndexOptions<Document> {
	/**
	 * Whether to return all found documents, or the first one.
	 *
	 * @default true
	 */
	multiple: boolean;
	/** {@link Projection} to apply on found documents. */
	projection: Projection<Document>;
	/** Sort found documents before returning them. */
	sort: SortFields<Document>;
}

/**
 * Options for documents replacing.
 *
 * @inheritDoc {@link FindOptions}
 */
interface ReplaceOptions<Document> extends Omit<FindOptions<Document>, 'sort' | 'projection'> {
	/**
	 * Whether to insert replacement if no matches found.
	 *
	 * @default false
	 */
	upsert: boolean;
}

/**
 * Options for documents updating.
 *
 * @inheritDoc {@link FindOptions}
 */
interface UpdateOptions<Document> extends Omit<FindOptions<Document>, 'sort' | 'projection'> {
	/**
	 * Whether to return updated documents, or the old ones.
	 *
	 * @default false
	 */
	returnUpdated: boolean;
}

/**
 * Options for documents deleting.
 *
 * @inheritDoc {@link FindOptions}
 */
interface DeleteOptions<Document> extends Omit<FindOptions<Document>, 'sort' | 'projection'> {}

/**
 * Contract that documents have to implement. <br> Documents must be cloneable and have a immutable
 * primary key.
 */
interface DocumentContract<DocType> extends Cloneable<DocType>, Recordable {}

export {
	type KeyOf,
	type IndexedKey,
	type SortFields,
	type Query,
	UpdateOperators,
	ProjectionType,
	type Projection,
	type IndexedProperty,
	type FindOptions,
	type ReplaceOptions,
	type UpdateOptions,
	type DeleteOptions,
	type IndexOptions,
	type DocumentContract,
	type QueryConditions,
	QueryOperators,
	SortDirection,
	PK_INDEX_NAME
};
