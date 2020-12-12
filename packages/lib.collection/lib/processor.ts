import { ObjMap, Optional } from '@thermopylae/core.declarations';
import { IndexedStore, IndexValue } from '@thermopylae/lib.indexed-store';
import orderBy from 'lodash.orderby';
import dotprop from 'dot-prop';
// @ts-ignore
import { createUpdate } from 'common-query';
import { createException, ErrorCodes } from './error';
import { DocumentContract, IndexedKey, Projection, ProjectionType, SortFields, PK_INDEX_NAME } from './typings';

/**
 * @internal
 */
class Processor<Document extends DocumentContract<Document>> {
	private readonly storage: IndexedStore<Document>;

	private readonly skipQueryValidation: boolean;

	public constructor(storage: IndexedStore<Document>, validateQueries?: boolean) {
		this.storage = storage;
		this.skipQueryValidation = validateQueries == null ? false : !validateQueries;
	}

	// FIXME mention about index renaming: delete + set
	public update(matches: Array<Document>, update: ObjMap): void {
		const { indexes } = this.storage; // they are expensive to compute

		update = createUpdate(update, { skipValidate: this.skipQueryValidation });
		const updatedIndexes = update.getUpdatedFields().filter((field: string) => indexes.includes(field)) as Array<IndexedKey<Document>>;

		// this code was duplicated for speed
		if (updatedIndexes.length) {
			for (const match of matches) {
				const snapshot = Processor.snapshotIndexableProperties(match, updatedIndexes);

				update.apply(match);

				for (const updatedIndex of updatedIndexes) {
					const newValue = dotprop.get(match, updatedIndex) as IndexValue;
					this.storage.reindex(updatedIndex, snapshot[updatedIndex], newValue, match[PK_INDEX_NAME]);
				}
			}

			return;
		}

		for (const match of matches) {
			update.apply(match);
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
			throw createException(ErrorCodes.REQUIRED, 'At leas one sorting field needs to be present. Found: 0.');
		}

		return orderBy(matches, Object.keys(sortFields), Object.values(sortFields));
	}

	private static applyProjection<Document>(documentClone: Document, projection: Projection<Document>): Document {
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

	private static snapshotIndexableProperties<Document>(
		document: Document,
		indexes: Array<IndexedKey<Document>>
	): Record<IndexedKey<Document>, Optional<IndexValue>> {
		const snapshot = {} as Record<IndexedKey<Document>, Optional<IndexValue>>;

		for (const index of indexes) {
			snapshot[index] = dotprop.get(document, index);
		}

		return snapshot;
	}
}

export { Processor };
