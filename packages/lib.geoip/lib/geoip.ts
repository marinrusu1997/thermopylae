import { ErrorCodes } from '@thermopylae/core.declarations';
import type { IpLocation, IpLocationsRepository } from './repository';
import { LoadBalancer } from './load-balancer';
import { createException } from './error';

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
	 * > This is caused by the way repositories are selected to retrieve location for that ip. <br/>
	 * > If you need same location object at each invocation, you can explicitly define `repo` from where
	 * > to fetch location. Notice that location has {@link IpLocation.REPOSITORY_ID} property which indicates
	 * > from which repository it was retrieved.
	 *
	 * @param ip	Ip address.
	 * @param repo	Id of the repository from where to fetch location.
	 *
	 * @returns		Ip location.
	 */
	public async locate(ip: string, repo?: string): Promise<IpLocation | null> {
		if (repo != null) {
			return this.getRepository(repo).lookup(ip);
		}

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

	private getRepository(id: string): IpLocationsRepository {
		for (const repo of this.loadBalancer.repositories) {
			if (repo.id === id) {
				return repo;
			}
		}
		throw createException(ErrorCodes.NOT_FOUND, `Repository with id ${id} not found.`);
	}
}

export { GeoIpLocator };
