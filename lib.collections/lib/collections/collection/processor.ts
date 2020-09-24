import sorter from 'thenby';
import { ComparisonResult, ObjMap, Optional, SortDirection, SyncFunction } from '@thermopylae/core.declarations';
import dotprop from 'dot-prop';
// @ts-ignore
import { createUpdate } from 'common-query';
import { createException, ErrorCodes } from '../../error';
import { DocumentContract, IndexedKey, Projection, ProjectionType, SortFields } from './typings';
import { IndexedStore, IndexValue, PRIMARY_KEY_INDEX } from '../indexed-store';
import { CompareFunction } from '../../commons';

interface IndexChange<Document> {
	name: IndexedKey<Document>;
	newValue: IndexValue;
}

class Processor<Document extends DocumentContract<Document>> {
	private readonly storage: IndexedStore<Document>;

	private readonly skipQueryValidation: boolean;

	public constructor(storage: IndexedStore<Document>, validateQueries?: boolean) {
		this.storage = storage;
		this.skipQueryValidation = validateQueries == null ? false : !validateQueries;
	}

	public update(matches: Array<Document>, update: ObjMap): void {
		const { indexes } = this.storage; // they are expensive to compute
		const changedIndexes = new Array<IndexChange<Document>>();

		update = createUpdate(update, { skipValidate: this.skipQueryValidation });
		if (update.getUpdatedFields().includes(PRIMARY_KEY_INDEX)) {
			throw createException(ErrorCodes.INVALID_UPDATE, `Updating ${PRIMARY_KEY_INDEX} is not allowed.`);
		}

		update.on('modifiedField', (field: IndexedKey<Document>, newValue: IndexValue) => {
			if (this.storage.containsIndex(field)) {
				changedIndexes.push({ name: field, newValue });
			}
		});

		const updateFn = update.createUpdateFn() as SyncFunction<Document, boolean>;

		for (const match of matches) {
			const snapshot = Processor.snapshotIndexableProperties(match, indexes);

			updateFn(match);
			for (const changedIndex of changedIndexes) {
				this.storage.updateIndex(changedIndex.name, snapshot[changedIndex.name], changedIndex.newValue, match[PRIMARY_KEY_INDEX]);
			}

			changedIndexes.length = 0; // prepare for next iteration
		}
	}

	public static clone<Document extends DocumentContract<Document>>(matches: Array<Document>): Array<Document> {
		return matches.map((document) => document.clone());
	}

	public static project<Document extends DocumentContract<Document>>(matches: Array<Document>, projection: Projection<Document>): Array<Document> {
		return matches.map((document) => Processor.applyProjection(document.clone(), projection));
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
				throw createException(ErrorCodes.UNKNOWN, `Sort direction ${direction} for field ${field} can't be processed.`);
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

		throw createException(ErrorCodes.UNKNOWN, `Type ${typeof firstValue} can't be compared.`);
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
				throw createException(ErrorCodes.UNKNOWN, `Projection type '${projection.type} can't be handled.`);
		}
		return documentClone;
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
