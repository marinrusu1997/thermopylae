import sorter from 'thenby';
import { ComparisonResult, ObjMap, Optional, SortDirection } from '@thermopylae/core.declarations';
import dotprop from 'dot-prop';
// @ts-ignore
import mongoQuery from 'mongo-query';
import { createError, ErrorCodes } from '../../error';
import { Alteration, AlterationType, DocumentContract, IndexedKey, Projection, ProjectionType, SortFields } from './typings';
import { IndexedStore, IndexValue, PRIMARY_KEY_INDEX } from '../indexed-store';
import { CompareFunction } from '../../commons';

class Processor {
	private static readonly RE_INDEXABLE_ALTERATIONS = new Set([AlterationType.SET, AlterationType.INC, AlterationType.RENAME, AlterationType.UNSET]);

	public static clone<Document extends DocumentContract<Document>>(matches: Array<Document>): Array<Document> {
		return matches.map((document) => document.clone());
	}

	public static project<Document extends DocumentContract<Document>>(matches: Array<Document>, projection: Projection<Document>): Array<Document> {
		return matches.map((document) => Processor.applyProjection(document.clone(), projection));
	}

	public static update<Document extends DocumentContract<Document>>(matches: Array<Document>, update: ObjMap, storage: IndexedStore<Document>): void {
		const { indexes } = storage; // they are expensive to compute

		for (const match of matches) {
			const snapshot = Processor.snapshotIndexableProperties(match, indexes);
			const changes = mongoQuery(match, {}, update);
			Processor.updateIndexableProperties(storage, match, snapshot, changes);
		}
	}

	public static sort<Document extends DocumentContract<Document>>(matches: Array<Document>, sortFields: SortFields<Document>): Array<Document> {
		if (matches.length <= 1) {
			return matches; // 0 or 1 match, we have nothing to sort there
		}

		const fields = Object.keys(sortFields);
		if (fields.length === 0) {
			return matches;
		}

		let fieldIndex = 0;

		const comparator = sorter.firstBy(Processor.comparator<Document>(fields[fieldIndex], sortFields[fields[fieldIndex]]));

		for (++fieldIndex; fieldIndex < fields.length; fieldIndex++) {
			comparator.thenBy(Processor.comparator<Document>(fields[fieldIndex], sortFields[fields[fieldIndex]]));
		}

		return matches.sort(comparator);
	}

	private static comparator<Document extends DocumentContract<Document>>(field: IndexedKey<Document>, direction: SortDirection): CompareFunction<Document> {
		return function compare(first: Document, second: Document): ComparisonResult {
			return Processor.compareDocuments(first, second, field, direction);
		};
	}

	private static compareDocuments<Document extends DocumentContract<Document>>(
		first: Document,
		second: Document,
		field: IndexedKey<Document>,
		direction: SortDirection
	): ComparisonResult {
		switch (direction) {
			case SortDirection.ASCENDING:
				return Processor.compareFields(first, second, field);
			case SortDirection.DESCENDING:
				return Processor.compareFields(second, first, field);
			default:
				throw createError(ErrorCodes.UNKNOWN, `Sort direction ${direction} for field ${field} can't be processed.`);
		}
	}

	private static compareFields<Document extends DocumentContract<Document>>(
		first: Document,
		second: Document,
		field: IndexedKey<Document>
	): ComparisonResult {
		const firstValue = dotprop.get(first, field);
		const secondValue = dotprop.get(second, field);

		if (firstValue == null) {
			return ComparisonResult.SMALLER;
		}

		if (secondValue == null) {
			return ComparisonResult.GREATER;
		}

		if (typeof firstValue === 'string' && typeof secondValue === 'string') {
			return firstValue.localeCompare(secondValue);
		}

		if (typeof firstValue === 'number' && typeof secondValue === 'number') {
			return firstValue - secondValue;
		}

		if (Array.isArray(firstValue) && Array.isArray(secondValue)) {
			return firstValue.length - secondValue.length;
		}

		throw createError(ErrorCodes.UNKNOWN, `Type ${typeof firstValue} can't be compared.`);
	}

	private static applyProjection<Document extends DocumentContract<Document>>(documentClone: Document, projection: Projection<Document>): any {
		switch (projection.type) {
			case ProjectionType.EXCLUDE:
				for (const field of projection.fields) {
					dotprop.delete(documentClone, field);
				}
				break;
			case ProjectionType.INCLUDE:
				{
					const replacement = Object.create(Object.getPrototypeOf(documentClone));
					for (const field of projection.fields) {
						dotprop.set(replacement, field, dotprop.get(documentClone, field));
					}
					documentClone = replacement;
				}
				break;
			default:
				throw createError(ErrorCodes.UNKNOWN, `Projection type '${projection.type} can't be handled.`);
		}
		return documentClone;
	}

	private static updateIndexableProperties<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		document: Document,
		snapshot: Record<IndexedKey<Document>, Optional<IndexValue>>,
		changes: ReadonlyArray<Alteration<Document>>
	): void {
		function matcher(record: Document): boolean {
			return record[PRIMARY_KEY_INDEX] === document[PRIMARY_KEY_INDEX];
		}

		for (const change of changes) {
			if (Processor.RE_INDEXABLE_ALTERATIONS.has(change.op) && storage.containsIndex(change.key)) {
				storage.updateIndex(change.key, snapshot[change.key], change.value as IndexValue, matcher);
				continue;
			}
		}
	}

	private static snapshotIndexableProperties<Document extends DocumentContract<Document>>(
		document: Document,
		indexes: ReadonlyArray<IndexedKey<Document>>
	): Record<IndexedKey<Document>, Optional<IndexValue>> {
		const snapshot = {} as Record<IndexedKey<Document>, Optional<IndexValue>>;

		for (const index of indexes) {
			snapshot[index] = dotprop.get(document, index);
		}

		return snapshot;
	}
}

export { Processor };
