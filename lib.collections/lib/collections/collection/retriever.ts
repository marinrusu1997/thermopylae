import { Nullable, ObjMap, UnaryPredicate, Undefinable } from '@thermopylae/core.declarations';
import isObject from 'isobject';
// @ts-ignore
import MongooseFilter from 'filtr';
import dotProp from 'dot-prop';
import { IndexedStore, PRIMARY_KEY_INDEX } from '../indexed-store';
import { DocumentContract, FindCriteria, Hint, MongooseOperators, Query } from './typings';
import { Processor } from './processor';

class Retriever {
	public static retrieve<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		query?: Nullable<Query<Document>>,
		criteria?: Partial<FindCriteria<Document>>
	): Array<Document> {
		let matches = Retriever.getMatches(storage, query, criteria);

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

	private static getMatches<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		query?: Nullable<Query<Document>>,
		criteria?: Partial<FindCriteria<Document>>
	): Array<Document> {
		let multiple: Undefinable<boolean>;

		if (criteria == null) {
			if (query == null) {
				return storage.values;
			}
		} else {
			multiple = criteria.multiple;
		}

		const hint = Retriever.inferHints(query, criteria); // needs to be above!
		query = Retriever.queryToPredicate(query);

		if (multiple) {
			return storage.filter(query, hint.index, hint.value);
		}

		const match = storage.find(query, hint.index, hint.value);
		return match !== undefined ? [match] : [];
	}

	private static queryToPredicate<Document>(query?: Nullable<Query<Document>>): UnaryPredicate<Document> {
		if (query == null) {
			return () => true; // match all documents
		}

		if (query instanceof Function) {
			return query;
		}

		const filter = new MongooseFilter(query);
		const testOptions = { type: 'single' };

		return function predicate(document: Document) {
			return filter.test(document, testOptions);
		};
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
