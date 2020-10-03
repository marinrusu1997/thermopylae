import { ErrorCodes, Nullable, ObjMap, UnaryPredicate } from '@thermopylae/core.declarations';
import { IndexedStore, PRIMARY_KEY_INDEX } from '@thermopylae/lib.indexed-store';
import isObject from 'isobject';
// @ts-ignore
import { createQuery } from 'common-query';
import dotProp from 'dot-prop';
import { DocumentContract, FindOptions, IndexedProperty, Query, QueryOperators } from './typings';
import { Processor } from './processor';
import { createException } from './error';

/**
 * @internal
 */
class Retriever<Document extends DocumentContract<Document>> {
	private readonly storage: IndexedStore<Document>;

	private readonly skipQueryValidation: boolean;

	public constructor(storage: IndexedStore<Document>, validateQueries?: boolean) {
		this.storage = storage;
		this.skipQueryValidation = validateQueries == null ? false : !validateQueries;
	}

	public retrieve(query?: Nullable<Query<Document>>, options?: Partial<FindOptions<Document>>): Array<Document> {
		let matches = this.getMatches(query, options);

		if (options && matches.length) {
			if (options.projection) {
				matches = Processor.project(matches, options.projection);
			}

			if (options.sort) {
				matches = Processor.sort(matches, options.sort);
			}
		}

		return matches;
	}

	private getMatches(query?: Nullable<Query<Document>>, options?: Partial<FindOptions<Document>>): Array<Document> {
		let multiple = true;

		if (options == null) {
			if (query == null) {
				return this.storage.values;
			}
		} else if (options.multiple != null) {
			multiple = options.multiple;
		}

		if (typeof query === 'string' || typeof query === 'number') {
			// read by primary key, we clone index, so that caller can't alter our internal state
			return [...this.storage.read(PRIMARY_KEY_INDEX, query)];
		}

		const indexedProperty = Retriever.inferIndexedProperty(query, options); // needs to be above!
		query = this.queryToPredicate(query);

		if (multiple) {
			return this.storage.filter(query, indexedProperty.name, indexedProperty.value);
		}

		const match = this.storage.find(query, indexedProperty.name, indexedProperty.value);
		return match !== undefined ? [match] : [];
	}

	private queryToPredicate<Document>(query?: Nullable<Query<Document>>): UnaryPredicate<Document> {
		if (query == null) {
			return () => true; // match all documents
		}

		if (query instanceof Function) {
			return query;
		}

		query = createQuery(query, { skipValidate: this.skipQueryValidation });
		return (doc) => (query as ObjMap).matches(doc);
	}

	private static inferIndexedProperty<Document>(
		query?: Nullable<Query<Document>>,
		options?: Partial<FindOptions<Document>>
	): Partial<IndexedProperty<Document>> {
		if (options == null) {
			if (isObject(query)) {
				const primaryKeyCondition = dotProp.get(query as ObjMap, PRIMARY_KEY_INDEX);

				if (typeof primaryKeyCondition === 'string' || typeof primaryKeyCondition === 'number') {
					return { name: PRIMARY_KEY_INDEX, value: primaryKeyCondition };
				}

				if (isObject(primaryKeyCondition)) {
					const operators = Object.entries(primaryKeyCondition as ObjMap);

					if (operators.length === 1) {
						if (operators[0][0] === '$eq') {
							throw createException(ErrorCodes.INVALID_VALUE, "Operator '$eq' is not supported. Specify value directly.");
						}

						if (operators[0][0] === QueryOperators.IN && Array.isArray(operators[0][1]) && operators[0][1].length === 1) {
							return { name: PRIMARY_KEY_INDEX, value: operators[0][1][0] };
						}
					}
				}
			}

			return {};
		}

		return options.index || {};
	}
}

export { Retriever };
