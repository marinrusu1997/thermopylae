import { UnaryPredicate } from '@thermopylae/core.declarations';
// @ts-ignore
import MongooseFilter from 'filtr';
import { IndexedStore } from '../indexed-store';
import { DocumentContract, FindCriteria, Hint, Query } from './typings';
import { createError, ErrorCodes } from '../../error';
import { Processor } from './processor';

class Retriever {
	public static retrieve<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		query?: Query<Document>,
		criteria?: Partial<FindCriteria<Document>>
	): Array<Document> {
		criteria = criteria || {};

		let matches = Retriever.getMatches(storage, criteria, query);

		if (criteria.projection) {
			matches = Processor.project(matches, criteria.projection);
		}

		if (criteria.sort) {
			matches = Processor.sort(matches, criteria.sort);
		}

		return matches;
	}

	private static getMatches<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		criteria: Partial<FindCriteria<Document>>,
		query?: Query<Document>
	): Array<Document> {
		if (query == null) {
			return storage.values;
		}

		query = Retriever.queryToPredicate(query);
		const hint: Partial<Hint<Document>> = criteria.hint || {};

		if (criteria.multiple) {
			return storage.filter(query, hint.index, hint.value);
		}

		const match = storage.find(query, hint.index, hint.value);
		return match !== undefined ? [match] : [];
	}

	private static queryToPredicate<Document>(query: Query<Document>): UnaryPredicate<Document> {
		if (query instanceof Function) {
			return query;
		}

		const filter = new MongooseFilter(query);
		if (filter == null || filter.test == null) {
			throw createError(ErrorCodes.INVALID_QUERY, `Query must conform to mongoose standard. Given: ${JSON.stringify(query)}.`);
		}

		const testOptions = { type: 'single' };
		return function predicate(document: Document): boolean {
			return filter.test(document, testOptions);
		};
	}
}

export { Retriever };
