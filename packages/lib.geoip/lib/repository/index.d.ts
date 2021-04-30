/**
 * Represents location of the IP address.
 */
declare interface IpLocation {
	readonly countryCode: string | null;
	readonly regionCode: string | null;
	readonly city: string | null;
	readonly timezone: string | null;
	readonly latitude: number | null;
	readonly longitude: number | null;
}

/**
 * Repository of IP address locations.
 */
declare interface IpLocationsRepository {
	/**
	 * Whether repository is available to server lookup requests.
	 */
	readonly available: boolean;

	/**
	 * Repository weight. <br/>
	 * Used by weighted round robin algorithm.
	 */
	readonly weight: number;

	/**
	 * Lookup location of the `ip` address.
	 *
	 * @param ip    IP address.
	 *
	 * @returns     Location of ip address.
	 */
	lookup(ip: string): Promise<IpLocation | null>;
}

export { IpLocationsRepository, IpLocation };
