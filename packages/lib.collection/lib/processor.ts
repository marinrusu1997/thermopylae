import { ObjMap, Optional } from '@thermopylae/core.declarations';
import { IndexedStore, IndexValue } from '@thermopylae/lib.indexed-store';
import orderBy from 'lodash.orderby';
import dotprop from 'dot-prop';
// @ts-ignore
import { createUpdate } from 'common-query';
import { createException, ErrorCodes } from './error';
import { DocumentContract, IndexedKey, Projection, ProjectionType, SortFields, PK_INDEX_NAME } from './typings';

/**
 * @private
 */
class Processor<Document extends DocumentContract<Document>> {
	private readonly storage: IndexedStore<Document>;

	private readonly skipQueryValidation: boolean;

	public constructor(storage: IndexedStore<Document>, validateQueries?: boolean) {
		this.storage = storage;
		this.skipQueryValidation = validateQueries == null ? false : !validateQueries;
	}

	public update(matches: Array<Document>, update: ObjMap): void {
		const { indexes } = this.storage; // they are expensive to compute

		update = createUpdate(update, { skipValidate: this.skipQueryValidation });
		const updatedIndexes = update['getUpdatedFields']().filter((field: string) => indexes.includes(field)) as Array<IndexedKey<Document>>;

		// this code was duplicated for speed
		if (updatedIndexes.length) {
			for (const match of matches) {
				const snapshot = Processor.snapshotIndexableProperties(match, updatedIndexes);

				update['apply'](match);

				for (const updatedIndex of updatedIndexes) {
					const newValue = dotprop.get(match, updatedIndex) as IndexValue;
					this.storage.reindex(updatedIndex, snapshot[updatedIndex], newValue, match[PK_INDEX_NAME]);
				}
			}

			return;
		}

		for (const match of matches) {
			update['apply'](match);
		}
	}

	public static clone<DocumentType extends DocumentContract<DocumentType>>(matches: Array<DocumentType>): Array<DocumentType> {
		return matches.map((document) => document.clone());
	}

	public static project<DocumentType extends DocumentContract<DocumentType>>(
		matches: Array<DocumentType>,
		projection: Projection<DocumentType>
	): Array<DocumentType> {
		return matches.map((document) => Processor.applyProjection(document.clone(), projection));
	}

	public static sort<DocumentType extends DocumentContract<DocumentType>>(
		matches: Array<DocumentType>,
		sortFields: SortFields<DocumentType>
	): Array<DocumentType> {
		if (matches.length <= 1) {
			return matches; // 0 or 1 match, we have nothing to sort there
		}

		const fields = Object.keys(sortFields);
		if (fields.length === 0) {
			throw createException(ErrorCodes.SORTING_FIELD_REQUIRED, 'At leas one sorting field needs to be present. Found: 0.');
		}

		return orderBy(matches, Object.keys(sortFields), Object.values(sortFields));
	}

	private static applyProjection<DocumentType>(documentClone: DocumentType, projection: Projection<DocumentType>): DocumentType {
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
				throw createException(ErrorCodes.UNKNOWN_PROJECTION_TYPE, `Projection type '${projection.type} can't be handled.`);
		}
		return documentClone;
	}

	private static snapshotIndexableProperties<DocumentType>(
		document: DocumentType,
		indexes: Array<IndexedKey<DocumentType>>
	): Record<IndexedKey<DocumentType>, Optional<IndexValue>> {
		const snapshot = {} as Record<IndexedKey<DocumentType>, Optional<IndexValue>>;

		for (const index of indexes) {
			snapshot[index] = dotprop.get(document, index);
		}

		return snapshot;
	}
}

export { Processor };
