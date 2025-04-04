/** Represents location of the IP address. */
interface IpLocation {
	/** Id of the repository from where location was fetched. */
	readonly REPOSITORY_ID: string;

	readonly countryCode: string | null;
	readonly regionCode: string | null;
	readonly city: string | null;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly timezone: string | null;
}

/** Repository of IP address locations. */
interface IpLocationsRepository {
	/** Repository id. */
	readonly id: string;

	/** Whether repository is available to serve lookup requests. */
	readonly available: boolean;

	/** Repository weight. <br/> Used by weighted round robin algorithm. */
	readonly weight: number;

	/**
	 * Lookup location of the `ip` address.
	 *
	 * @param   ip IP address.
	 *
	 * @returns    Location of ip address.
	 */
	lookup(ip: string): Promise<IpLocation | null>;
}

export type { IpLocationsRepository, IpLocation };
