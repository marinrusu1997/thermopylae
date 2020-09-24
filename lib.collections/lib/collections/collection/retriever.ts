import { Nullable, ObjMap, UnaryPredicate, Undefinable } from '@thermopylae/core.declarations';
import isObject from 'isobject';
// @ts-ignore
import { createQuery } from 'common-query';
import dotProp from 'dot-prop';
import { IndexedStore, PRIMARY_KEY_INDEX } from '../indexed-store';
import { DocumentContract, FindCriteria, Hint, MongooseOperators, Query } from './typings';
import { Processor } from './processor';

class Retriever<Document extends DocumentContract<Document>> {
	private readonly storage: IndexedStore<Document>;

	private readonly skipQueryValidation: boolean;

	public constructor(storage: IndexedStore<Document>, validateQueries?: boolean) {
		this.storage = storage;
		this.skipQueryValidation = validateQueries == null ? false : !validateQueries;
	}

	public retrieve(query?: Nullable<Query<Document>>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		let matches = this.getMatches(query, criteria);

		if (criteria && matches.length) {
			if (criteria.projection) {
				matches = Processor.project(matches, criteria.projection);
			}

			if (criteria.sort) {
				matches = Processor.sort(matches, criteria.sort);
			}
		}

		return matches;
	}

	private getMatches(query?: Nullable<Query<Document>>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		let multiple: Undefinable<boolean>;

		if (criteria == null) {
			if (query == null) {
				return this.storage.values;
			}
		} else {
			multiple = criteria.multiple;
		}

		const hint = Retriever.inferHints(query, criteria); // needs to be above!
		query = this.queryToPredicate(query);

		if (multiple) {
			return this.storage.filter(query, hint.index, hint.value);
		}

		const match = this.storage.find(query, hint.index, hint.value);
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
		return (value) => (query as ObjMap).matches(value);
	}

	private static inferHints<Document>(query?: Nullable<Query<Document>>, criteria?: Partial<FindCriteria<Document>>): Partial<Hint<Document>> {
		if (criteria == null) {
			if (isObject(query)) {
				const primaryKeyCondition = dotProp.get(query as ObjMap, PRIMARY_KEY_INDEX);

				if (typeof primaryKeyCondition === 'string' || typeof primaryKeyCondition === 'number') {
					return { index: PRIMARY_KEY_INDEX, value: primaryKeyCondition };
				}

				if (isObject(primaryKeyCondition)) {
					const operators = Object.entries(primaryKeyCondition as ObjMap);

					if (operators.length === 1) {
						if (operators[0][0] === MongooseOperators.EQUAL) {
							return { index: PRIMARY_KEY_INDEX, value: operators[0][1] };
						}

						if (operators[0][0] === MongooseOperators.IN && Array.isArray(operators[0][1]) && operators[0][1].length === 1) {
							return { index: PRIMARY_KEY_INDEX, value: operators[0][1][0] };
						}
					}
				}
			}

			return {};
		}

		return criteria.hint || {};
	}
}

export { Retriever };
