import { Nullable, UnaryPredicate, Undefinable } from '@thermopylae/core.declarations';
// @ts-ignore
import MongooseFilter from 'filtr';
import { IndexedStore } from '../indexed-store';
import { DocumentContract, FindCriteria, Hint, Query } from './typings';
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
		let hint: Partial<Hint<Document>>;
		let multiple: Undefinable<boolean>;

		if (criteria == null) {
			if (query == null) {
				return storage.values;
			}
			hint = {};
		} else {
			hint = criteria.hint || {};
			multiple = criteria.multiple;
		}

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
}

export { Retriever };
