import type { Nullable, ObjMap, UnaryPredicate } from '@thermopylae/core.declarations';
import type { IndexedStore } from '@thermopylae/lib.indexed-store';
// @ts-expect-error This package has no typingsypings
import { createQuery } from 'common-query';
import { getProperty } from 'dot-prop';
import isObject from 'isobject';
import isFunction from 'lodash.isfunction';
import { ErrorCodes, createException } from './error.js';
import { Processor } from './processor.js';
import { type DocumentContract, type FindOptions, type IndexedProperty, PK_INDEX_NAME, type Query, QueryOperators } from './typings.js';

/** @private */
class Retriever<Document extends DocumentContract<Document>> {
	private readonly storage: IndexedStore<Document>;

	private readonly skipQueryValidation: boolean;

	public constructor(storage: IndexedStore<Document>, validateQueries?: boolean) {
		this.storage = storage;
		this.skipQueryValidation = validateQueries == null ? false : !validateQueries;
	}

	public retrieve(query?: Nullable<Query<Document>>, options?: Partial<FindOptions<Document>>): Document[] {
		let matches = this.getMatches(query, options);

		if (options && matches.length > 0) {
			if (options.projection) {
				matches = Processor.project(matches, options.projection);
			}

			if (options.sort) {
				matches = Processor.sort(matches, options.sort);
			}
		}

		return matches;
	}

	private getMatches(query?: Nullable<Query<Document>>, options?: Partial<FindOptions<Document>>): Document[] {
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
			return [...this.storage.read(PK_INDEX_NAME, query)];
		}

		const indexedProperty = Retriever.inferIndexedProperty(query, options); // needs to be above!
		query = this.queryToPredicate(query);

		if (multiple) {
			return this.storage.filter(query, indexedProperty.name, indexedProperty.value);
		}

		const match = this.storage.find(query, indexedProperty.name, indexedProperty.value);
		return match === undefined ? [] : [match];
	}

	private queryToPredicate(query?: Nullable<Query<Document>>): UnaryPredicate<Document> {
		if (query == null) {
			return () => true; // match all documents
		}

		if (isFunction(query)) {
			return query;
		}

		query = createQuery(query, { skipValidate: this.skipQueryValidation });
		return (doc) => (query as ObjMap)['matches'](doc);
	}

	private static inferIndexedProperty<DocumentType extends DocumentContract<DocumentType>>(
		query?: Nullable<Query<DocumentType>>,
		options?: Partial<FindOptions<DocumentType>>
	): Partial<IndexedProperty<DocumentType>> {
		if (options == null) {
			// @ts-expect-error-error
			if (isObject(query)) {
				const primaryKeyCondition = getProperty(query as ObjMap, PK_INDEX_NAME);

				if (typeof primaryKeyCondition === 'string' || typeof primaryKeyCondition === 'number') {
					return { name: PK_INDEX_NAME, value: primaryKeyCondition };
				}

				// @ts-expect-error-error
				if (isObject(primaryKeyCondition)) {
					const operators = Object.entries(primaryKeyCondition as unknown as ObjMap);

					if (operators.length === 1) {
						if (operators[0][0] === '$eq') {
							throw createException(ErrorCodes.OPERATOR_NOT_SUPPORTED, "Operator '$eq' is not supported. Specify value directly.");
						}

						if (operators[0][0] === QueryOperators.IN && Array.isArray(operators[0][1]) && operators[0][1].length === 1) {
							return { name: PK_INDEX_NAME, value: operators[0][1][0] as string };
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
