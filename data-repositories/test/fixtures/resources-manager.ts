import { Queue } from 'queue-typescript';
import { beginTransaction, commitTransaction, MySqlClientInstance, rollbackTransaction } from '@marin/lib.data-access';
import { ResourceType } from './commons';
import { createEnvResources } from './test-env';
import { cleanResources } from './cleanup';
import { Logger } from './logger';

interface RequiredResources {
	acquire: Set<ResourceType> | null;
	release: Set<ResourceType> | null;
}

type Priority = 'normal' | 'high';

class ResourcesManager {
	private readonly normalQueue: Queue<RequiredResources> = new Queue<RequiredResources>();

	private priorityQueue: Queue<RequiredResources> | null = null;

	private currentQueue: Queue<RequiredResources> = this.normalQueue;

	// @ts-ignore
	private currentRequiredResources: RequiredResources;

	public registerRequiredResources(resources: RequiredResources, priority: Priority = 'normal'): void {
		if (priority === 'high' && !this.priorityQueue) {
			Logger.warning('Resources will be managed according to priority queue.');

			this.priorityQueue = new Queue();
			this.currentQueue = this.priorityQueue;
		}

		this.currentQueue.enqueue(resources);
	}

	public markForDeletionInNextCleanup(resourceType: ResourceType): void {
		if (!this.currentRequiredResources.release) {
			this.currentRequiredResources.release = new Set();
		}

		this.currentRequiredResources.release.add(resourceType);
	}

	public createRequiredResources(): Promise<void> {
		this.currentRequiredResources = this.currentQueue.dequeue();

		if (!this.currentRequiredResources.acquire || !this.currentRequiredResources.acquire.size) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			MySqlClientInstance.writePool.getConnection(async (getConnErr, connection) => {
				if (getConnErr) {
					return reject(getConnErr);
				}

				try {
					await beginTransaction(connection);

					await createEnvResources(this.currentRequiredResources.acquire!);

					await commitTransaction(connection);

					return resolve();
				} catch (e) {
					return rollbackTransaction(connection)
						.then(() => reject(e))
						.catch(reject);
				} finally {
					connection.release();
				}
			});
		});
	}

	public cleanRequiredResources(): Promise<void> {
		if (!this.currentRequiredResources.release || !this.currentRequiredResources.release.size) {
			return Promise.resolve();
		}

		return cleanResources(this.currentRequiredResources.release);
	}
}

const ResourcesManagerInstance = new ResourcesManager();

export { ResourcesManagerInstance, RequiredResources };
