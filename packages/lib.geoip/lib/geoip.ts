import type { IpLocation, IpLocationsRepository } from './repository';
import { LoadBalancer } from './load-balancer';

/**
 * Geo IP locator which retrieves location of the IP address. <br/>
 * Locator has a set of repositories from where locations are fetched.
 * Repositories are load balanced via **weighted round robin algorithm**,
 * and tried in order until some of them retrieves location.
 */
class GeoIpLocator {
	private readonly loadBalancer: LoadBalancer;

	/**
	 * @param repositories Repositories from where locations can be fetched.
	 */
	public constructor(repositories: ReadonlyArray<IpLocationsRepository>) {
		this.loadBalancer = new LoadBalancer(repositories);
	}

	/**
	 * Retrieves location associated with an IP. <br/>
	 * > Notice that location might differ when invoking this function with the same `ip` multiple times. <br/>
	 * > This is caused by the way repositories are selected to retrieve location for that ip.
	 *
	 * @param ip	Ip address.
	 *
	 * @returns		Ip location.
	 */
	public async locate(ip: string): Promise<IpLocation | null> {
		let repository = null;
		let location = null;

		const notFoundRepos = new WeakSet<IpLocationsRepository>();

		while ((repository = this.loadBalancer.getRepository(notFoundRepos))) {
			location = await repository.lookup(ip);
			if (location) {
				return location;
			}
			notFoundRepos.add(repository);
		}

		return location;
	}
}

export { GeoIpLocator };
