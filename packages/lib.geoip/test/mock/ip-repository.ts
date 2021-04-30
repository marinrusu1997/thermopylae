import { IpLocation, IpLocationsRepository } from '../../lib';

class IpRepositoryMock implements IpLocationsRepository {
	public availability: boolean;

	public location: IpLocation | any | null;

	public lookups: number;

	private readonly w: number;

	public constructor(weight: number) {
		this.availability = true;
		this.location = null;
		this.w = weight;
		this.lookups = 0;
	}

	public get available(): boolean {
		return this.availability;
	}

	public get weight(): number {
		return this.w;
	}

	public lookup(): Promise<IpLocation | null> {
		this.lookups += 1;
		return Promise.resolve(this.location);
	}
}

export { IpRepositoryMock };
