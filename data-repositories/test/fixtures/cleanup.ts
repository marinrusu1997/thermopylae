import { MySqlClientInstance } from '@marin/lib.data-access';
import { ResourceType } from './commons';
import { Logger } from './logger';

const RESOURCES_CLEANERS = {
	[ResourceType.ACCOUNT]: cleanAccounts,
	[ResourceType.DEVICE]: cleanDevices,
	[ResourceType.LOCATION]: cleanLocations,
	[ResourceType.PERMISSION]: cleanPermissions,
	[ResourceType.ROLE]: cleanRoles,
	[ResourceType.USER_GROUP]: cleanUserGroup
};

function cleanAccounts(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Logger.debug('Cleaning up Accounts...');

		MySqlClientInstance.writePool.query('DELETE FROM Account;', (err, results) => {
			return err ? reject(err) : resolve(results.affectedRows);
		});
	});
}

function cleanDevices(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Logger.debug('Cleaning up Devices...');

		MySqlClientInstance.writePool.query('DELETE FROM Device;', (err, results) => {
			return err ? reject(err) : resolve(results.affectedRows);
		});
	});
}

function cleanLocations(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Logger.debug('Cleaning up Locations...');

		MySqlClientInstance.writePool.query('DELETE FROM Location;', (err, results) => {
			return err ? reject(err) : resolve(results.affectedRows);
		});
	});
}

function cleanPermissions(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Logger.debug('Cleaning up Permissions...');

		MySqlClientInstance.writePool.query('DELETE FROM Permission;', (err, results) => {
			return err ? reject(err) : resolve(results.affectedRows);
		});
	});
}

function cleanRoles(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Logger.debug('Cleaning up Roles...');

		MySqlClientInstance.writePool.query('DELETE FROM Role;', (err, results) => {
			return err ? reject(err) : resolve(results.affectedRows);
		});
	});
}

function cleanUserGroup(): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		Logger.debug('Cleaning up User Groups...');

		MySqlClientInstance.writePool.query('DELETE FROM UserGroup;', (err, results) => {
			return err ? reject(err) : resolve(results.affectedRows);
		});
	});
}

async function cleanResources(resourceTypes: Set<ResourceType>): Promise<void> {
	if (resourceTypes.has(ResourceType.ACCOUNT)) {
		resourceTypes.delete(ResourceType.ACCOUNT);
		await cleanAccounts();
	}

	const cleanPromises: Array<Promise<number>> = [];
	resourceTypes.forEach((resourceType) => cleanPromises.push(RESOURCES_CLEANERS[resourceType]()));
	await Promise.all(cleanPromises);

	resourceTypes.clear();
}

export { cleanResources };
