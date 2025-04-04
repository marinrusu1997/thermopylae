import type { IpLocationsRepository } from './repository/index.js';

/** @private */
class LoadBalancer {
	public readonly repositories: ReadonlyArray<IpLocationsRepository>;

	private readonly available: Array<IpLocationsRepository>;

	private availableLength!: number;

	private availableIter!: number;

	private totalWeight!: number;

	public constructor(repositories: ReadonlyArray<IpLocationsRepository>) {
		this.repositories = repositories;
		this.available = new Array(repositories.length);
		this.detectAvailable();
	}

	public getRepository(exclude: WeakSet<IpLocationsRepository>): IpLocationsRepository | null {
		this.detectAvailableRestricted(exclude);
		this.detectTotalWeight();

		const rnd = Math.floor(Math.random() * this.totalWeight) + 1;
		let n = 0;

		this.availableIter = 0;
		for (; this.availableIter < this.availableLength; this.availableIter++) {
			n += this.available[this.availableIter].weight;
			if (n >= rnd) {
				return this.available[this.availableIter];
			}
		}

		return null;
	}

	private detectTotalWeight(): void {
		this.totalWeight = 0;
		this.availableIter = 0;
		for (; this.availableIter < this.availableLength; this.availableIter++) {
			this.totalWeight += this.available[this.availableIter].weight;
		}
	}

	private detectAvailable(): void {
		this.availableLength = 0;
		for (const repo of this.repositories) {
			if (repo.available) {
				this.available[this.availableLength++] = repo;
			}
		}
	}

	private detectAvailableRestricted(exclude: WeakSet<IpLocationsRepository>): void {
		this.availableLength = 0;
		for (const repo of this.repositories) {
			if (repo.available && !exclude.has(repo)) {
				this.available[this.availableLength++] = repo;
			}
		}
	}
}

export { LoadBalancer };
