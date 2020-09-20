import { Cloneable, PersistablePrimitive, SortDirection, UnaryPredicate } from '@thermopylae/core.declarations';
// eslint-disable-next-line import/no-unresolved
import { QueryConditions } from '@b4dnewz/mongodb-operators';
import { IndexValue, PRIMARY_KEY_INDEX } from '../indexed-store';

type KeyOf<Document> = Exclude<keyof Document, symbol | number>;
type IndexedKey<Document> = KeyOf<Document> | string;

type SortFields<Document> = Record<IndexedKey<Document>, SortDirection>;

type Query<Document> = QueryConditions<Document> | UnaryPredicate<Document>;

const enum MongooseOperators {
	GREATER = '$gt',
	GREATER_OR_EQUAL = '$gte',
	LESS = '$lt',
	LESS_OR_EQUAL = '$lte',
	EXISTS = '$exists',
	MODULO = '$mod',
	EQUAL = '$eq',
	NOT_EQUAL = '$ne',
	IN = '$in',
	NOT_IN = '$nin',
	ARRAY_ALL = '$all',
	ARRAY_SIZE = '$size',
	OR = '$or',
	NOR = '$nor',
	AND = '$and'
}

const enum AlterationType {
	SET = '$set',
	INC = '$inc',
	POP = '$pop',
	RENAME = '$rename',
	PUSH = '$push',
	PUSH_ALL = '$pushAll',
	PULL = '$pull',
	PULL_ALL = '$pullAll',
	UNSET = '$unset',
	ADD_TO_SET = '$addToSet'
}

const enum ProjectionType {
	EXCLUDE,
	INCLUDE
}

interface Projection<Document> {
	type: ProjectionType;
	fields: ReadonlyArray<IndexedKey<Document>>;
}

interface Hint<Document> {
	index: IndexedKey<Document>;
	value?: IndexValue;
}

interface FindCriteria<Document> {
	multiple: boolean;
	sort: SortFields<Document>;
	hint: Hint<Document>;
	projection: Projection<Document>;
}

interface ReplaceCriteria<Document> extends Omit<FindCriteria<Document>, 'sort' | 'projection'> {
	upsert: boolean;
}

interface UpdateCriteria<Document> extends Omit<FindCriteria<Document>, 'sort' | 'projection'> {
	returnUpdates: boolean;
}

type DeleteCriteria<Document> = Omit<FindCriteria<Document>, 'sort' | 'projection'>;

interface MapReduceCriteria<Document> {
	hint: Hint<Document>;
}

interface Alteration<Document> {
	key: IndexedKey<Document>;
	op: AlterationType;
	value?: PersistablePrimitive | Array<PersistablePrimitive>;
	shift?: boolean;
}

interface DocumentContract<DocType> extends Cloneable<DocType> {
	readonly [PRIMARY_KEY_INDEX]: IndexValue;
}

export {
	KeyOf,
	IndexedKey,
	SortFields,
	Query,
	AlterationType,
	ProjectionType,
	Projection,
	Hint,
	FindCriteria,
	ReplaceCriteria,
	UpdateCriteria,
	DeleteCriteria,
	MapReduceCriteria,
	Alteration,
	DocumentContract,
	QueryConditions,
	MongooseOperators
};
