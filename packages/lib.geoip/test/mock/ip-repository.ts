import type { IpLocation, IpLocationsRepository } from '../../lib/index.js';

class IpRepositoryMock implements IpLocationsRepository {
	public availability: boolean;

	public location: IpLocation | null;

	public lookups: number;

	readonly #weight: number;

	public constructor(weight: number) {
		this.availability = true;
		this.location = null;
		this.#weight = weight;
		this.lookups = 0;
	}

	public get id(): string {
		return `mock-${Math.random()}`;
	}

	public get available(): boolean {
		return this.availability;
	}

	public get weight(): number {
		return this.#weight;
	}

	public lookup(): Promise<IpLocation | null> {
		this.lookups += 1;
		return Promise.resolve(this.location);
	}
}

export { IpRepositoryMock };
