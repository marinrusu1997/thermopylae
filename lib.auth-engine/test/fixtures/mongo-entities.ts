import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AuthenticationEntryPointEntity, AccountEntity, ActiveUserSessionEntity, FailedAuthenticationAttemptsEntity } from '../../lib/types/entities';

const mongod = new MongoMemoryServer();

// see https://stackoverflow.com/questions/51960171/node63208-deprecationwarning-collection-ensureindex-is-deprecated-use-creat
mongoose.set('useCreateIndex', true);

// see https://stackoverflow.com/questions/39035634/mocha-watch-and-mongoose-models
function getMongoModel(name: string, schema: mongoose.Schema): mongoose.Model<mongoose.Document> {
	return mongoose.models[name] // Check if the model exists
		? mongoose.model(name) // If true, only retrieve it
		: mongoose.model(name, schema); // If false, define it
}

enum ENTITIES_OP {
	FAILED_AUTH_ATTEMPTS_CREATE,
	ACTIVE_USER_SESSION_DELETE_ALL,
	ACCOUNT_DISABLE
}
const failures = new Map<ENTITIES_OP, boolean>();

const Models = {
	ACCOUNT: 'account',
	FAILED_AUTH_ATTEMPT: 'failed_auth_attempt',
	AUTHENTICATION_ENTRY_POINT: 'access_point',
	ACTIVE_USER_SESSION: 'active_user_session'
};

/* Account */
const AccountSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true, unique: true },
	salt: { type: String, required: true, unique: true },
	role: { type: String, required: false },
	email: { type: String, required: true },
	telephone: { type: String, required: true },
	enabled: { type: Boolean, required: true },
	usingMfa: { type: Boolean, required: true },
	pubKey: { type: String, required: false }
});
const AccountEntityMongo: AccountEntity = {
	create: async account => {
		const accountModel = await getMongoModel(Models.ACCOUNT, AccountSchema).create(account);
		return String(accountModel._id);
	},
	read: async username => {
		const accountModel = await getMongoModel(Models.ACCOUNT, AccountSchema)
			.find({ username })
			.exec();
		if (!accountModel.length) {
			return null;
		}
		if (accountModel.length > 1) {
			throw new Error(`Expected 1 account to be found for username ${username}`);
		}
		return {
			id: String(accountModel[0]._id),
			// @ts-ignore
			username: accountModel[0].username,
			// @ts-ignore
			password: accountModel[0].password,
			// @ts-ignore
			salt: accountModel[0].salt,
			// @ts-ignore
			role: accountModel[0].role,
			// @ts-ignore
			email: accountModel[0].email,
			// @ts-ignore
			telephone: accountModel[0].telephone,
			// @ts-ignore
			enabled: accountModel[0].enabled,
			// @ts-ignore
			usingMfa: accountModel[0].usingMfa,
			// @ts-ignore
			pubKey: accountModel[0].pubKey
		};
	},
	readById: async id => {
		const accountModel = await getMongoModel(Models.ACCOUNT, AccountSchema)
			.findById(id)
			.exec();
		if (!accountModel) {
			return null;
		}
		return {
			id: String(accountModel._id),
			// @ts-ignore
			username: accountModel.username,
			// @ts-ignore
			password: accountModel.password,
			// @ts-ignore
			salt: accountModel.salt,
			// @ts-ignore
			role: accountModel.role,
			// @ts-ignore
			email: accountModel.email,
			// @ts-ignore
			telephone: accountModel.telephone,
			// @ts-ignore
			enabled: accountModel.enabled,
			// @ts-ignore
			usingMfa: accountModel.usingMfa,
			// @ts-ignore
			pubKey: accountModel.pubKey
		};
	},
	enable: _id =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { enabled: true })
			.exec(),
	disable: async _id => {
		if (failures.get(ENTITIES_OP.ACCOUNT_DISABLE)) {
			throw new Error('Account disable was scheduled to fail');
		}

		return getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { enabled: false })
			.exec();
	},
	enableMultiFactorAuth: _id =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { usingMfa: true })
			.exec(),
	disableMultiFactorAuth: _id =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { usingMfa: false })
			.exec(),
	delete: _id => {
		return getMongoModel(Models.ACCOUNT, AccountSchema)
			.deleteOne({ _id })
			.exec()
			.then(result => {
				if (!result.ok || result.deletedCount !== 1) {
					throw new Error(`Failed to delete account with id ${_id}. Cause: ${JSON.stringify(result)}`);
				}
			});
	},
	changePassword: (_id, password, salt) =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { password, salt })
			.exec()
};

/* Failed Auth Attempts */
const FailedAuthAttemptSchema = new mongoose.Schema({
	accountId: { type: String, required: true },
	detectedAt: { type: Date, required: true, unique: true },
	device: String,
	ip: String
});
const FailedAuthAttemptsEntityMongo: FailedAuthenticationAttemptsEntity = {
	create: async attempts => {
		if (failures.get(ENTITIES_OP.FAILED_AUTH_ATTEMPTS_CREATE)) {
			throw new Error('Creation of failed auth attempts was configured to fail.');
		}

		return getMongoModel(Models.FAILED_AUTH_ATTEMPT, FailedAuthAttemptSchema)
			.create(attempts)
			.then(doc => String(doc._id));
	},
	readRange: async (accountId, startingFrom, endingTo) => {
		if (startingFrom && endingTo && endingTo < startingFrom) {
			throw new Error('Invalid range. Ending lower that starting');
		}

		const documentQuery = getMongoModel(Models.FAILED_AUTH_ATTEMPT, FailedAuthAttemptSchema).find({ accountId });
		if (startingFrom || endingTo) {
			documentQuery.where('detectedAt');
			if (startingFrom) {
				documentQuery.gte(startingFrom);
			}
			if (endingTo) {
				documentQuery.lt(endingTo);
			}
		}

		const docs = await documentQuery.exec();
		return docs.map(doc => ({
			id: String(doc._id),
			// @ts-ignore
			accountId: doc.accountId,
			// @ts-ignore
			detectedAt: doc.detectedAt,
			// @ts-ignore
			device: doc.device,
			// @ts-ignore
			ip: doc.ip
		}));
	}
};

/* Access Point */
// FIXME it would be nice if this can be stored in ES
const AuthenticationEntryPointSchema = new mongoose.Schema({
	authenticatedAtUNIX: { type: Number, required: true },
	accountId: { type: String, required: true },
	ip: { type: String, required: true },
	device: { type: String, required: true },
	location: {
		countryCode: { type: String, required: true },
		regionCode: { type: String, required: true },
		city: { type: String, required: true },
		timeZone: { type: String, required: true },
		postalCode: { type: String },
		latitude: { type: Number, required: true },
		longitude: { type: Number, required: true }
	}
});
const AuthenticationEntryPointEntityMongo: AuthenticationEntryPointEntity = {
	create: async accessPoint => {
		await getMongoModel(Models.AUTHENTICATION_ENTRY_POINT, AuthenticationEntryPointSchema).create(accessPoint);
	},
	authBeforeFromThisDevice: async (accountId, device) => {
		const prevAuth = await getMongoModel(Models.AUTHENTICATION_ENTRY_POINT, AuthenticationEntryPointSchema)
			.find({ accountId })
			.exec();
		if (prevAuth.length === 0) {
			return true; // this is the first login ever, don't send notification
		}

		for (let i = 0; i < prevAuth.length; i++) {
			// @ts-ignore
			if (prevAuth[i].device !== device) {
				return false;
			}
		}

		return true;
	}
};

/* Active User Session */
const ActiveUserSessionSchema = new mongoose.Schema({
	authenticatedAtUNIX: { type: Number, required: true },
	accountId: { type: String, required: true }
});
const ActiveUserSessionEntityMongo: ActiveUserSessionEntity = {
	create: async session => {
		await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema).create(session);
	},
	readAll: async accountId => {
		const sessionsDocs = await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema)
			.find({ accountId })
			.exec();
		if (sessionsDocs.length === 0) {
			return [];
		}
		// @ts-ignore
		const sessionTimestamps = sessionsDocs.map(session => session.authenticatedAtUNIX);
		const accessPointsDocs = await getMongoModel(Models.AUTHENTICATION_ENTRY_POINT, AuthenticationEntryPointSchema)
			.find({ authenticatedAtUNIX: { $in: sessionTimestamps }, accountId })
			.exec();
		return accessPointsDocs.map(accessPointDoc => {
			return {
				// @ts-ignore
				authenticatedAtUNIX: accessPointDoc.authenticatedAtUNIX,
				// @ts-ignore
				accountId: accessPointDoc.accountId,
				// @ts-ignore
				ip: accessPointDoc.ip,
				// @ts-ignore
				device: accessPointDoc.device,
				// @ts-ignore
				location: {
					// @ts-ignore
					countryCode: accessPointDoc.location.countryCode,
					// @ts-ignore
					regionCode: accessPointDoc.location.regionCode,
					// @ts-ignore
					city: accessPointDoc.location.city,
					// @ts-ignore
					timeZone: accessPointDoc.location.timeZone,
					// @ts-ignore
					postalCode: accessPointDoc.location.postalCode,
					// @ts-ignore
					latitude: accessPointDoc.location.latitude,
					// @ts-ignore
					longitude: accessPointDoc.location.longitude
				}
			};
		});
	},
	readAllButOne: async (accountId, exceptedSessionId) => {
		const sessionsDocs = await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema)
			.find({ accountId, authenticatedAtUNIX: { $ne: exceptedSessionId } })
			.exec();
		if (sessionsDocs.length === 0) {
			return [];
		}
		// @ts-ignore
		const sessionTimestamps = sessionsDocs.map(session => session.authenticatedAtUNIX);
		const accessPointsDocs = await getMongoModel(Models.AUTHENTICATION_ENTRY_POINT, AuthenticationEntryPointSchema)
			.find({ authenticatedAtUNIX: { $in: sessionTimestamps }, accountId })
			.exec();
		return accessPointsDocs.map(accessPointDoc => {
			return {
				// @ts-ignore
				authenticatedAtUNIX: accessPointDoc.authenticatedAtUNIX,
				// @ts-ignore
				accountId: accessPointDoc.accountId,
				// @ts-ignore
				ip: accessPointDoc.ip,
				// @ts-ignore
				device: accessPointDoc.device,
				// @ts-ignore
				location: {
					// @ts-ignore
					countryCode: accessPointDoc.location.countryCode,
					// @ts-ignore
					regionCode: accessPointDoc.location.regionCode,
					// @ts-ignore
					city: accessPointDoc.location.city,
					// @ts-ignore
					timeZone: accessPointDoc.location.timeZone,
					// @ts-ignore
					postalCode: accessPointDoc.location.postalCode,
					// @ts-ignore
					latitude: accessPointDoc.location.latitude,
					// @ts-ignore
					longitude: accessPointDoc.location.longitude
				}
			};
		});
	},
	delete: async (accountId, authenticatedAtUNIX) => {
		const deleteStatus = await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema)
			.deleteOne({ authenticatedAtUNIX, accountId })
			.exec();

		if (!deleteStatus.ok || deleteStatus.deletedCount !== 1) {
			throw new Error(`Deleting one active session for account ${accountId} with authenticatedAtUNIX ${authenticatedAtUNIX} failed.`);
		}
	},
	deleteAll: async accountId => {
		if (failures.get(ENTITIES_OP.ACTIVE_USER_SESSION_DELETE_ALL)) {
			throw new Error('Deleting of all active user sessions was configured to fail.');
		}

		const bulkDelete = await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema).deleteMany({ accountId });
		if (!bulkDelete.ok) {
			throw new Error('Failed to delete all sessions');
		}
		return bulkDelete.deletedCount!;
	},
	deleteAllButOne: async (accountId: string, exceptedSessionId: number) => {
		const bulkDelete = await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema).deleteMany({
			accountId,
			authenticatedAtUNIX: { $ne: exceptedSessionId }
		});
		if (!bulkDelete.ok) {
			throw new Error('Failed to delete all sessions');
		}
		return bulkDelete.deletedCount!;
	}
};

/**
 * Connect to the in-memory database.
 */
function connectToMongoServer(): Promise<mongoose.Mongoose> {
	return mongod.getConnectionString().then(uri => {
		const mongooseOpts: mongoose.ConnectionOptions = {
			useNewUrlParser: true,
			useUnifiedTopology: true
		};
		return mongoose.connect(uri, mongooseOpts);
	});
}

/**
 * Drop database, close the connection and stop mongod.
 */
function closeMongoDatabase(): Promise<boolean> {
	return mongoose.connection
		.dropDatabase()
		.then(() => {
			return mongoose.connection.close();
		})
		.then(() => {
			return mongod.stop();
		});
}

/**
 * Remove all the data for all db collections.
 */
function clearMongoDatabase(): Promise<any[]> {
	const collectionNames = Object.keys(mongoose.connection.collections);
	const deletePromises: Array<Promise<any>> = [];

	for (let i = 0; i < collectionNames.length; i += 1) {
		deletePromises.push(mongoose.connection.collections[collectionNames[i]].deleteMany({}));
	}

	return Promise.all(deletePromises);
}

function failureWillBeGeneratedForEntityOperation(op: ENTITIES_OP, willFail = true): void {
	failures.set(op, willFail);
}

function clearOperationFailuresForEntities(): void {
	failures.clear();
}

export {
	ENTITIES_OP,
	AccountEntityMongo,
	FailedAuthAttemptsEntityMongo,
	AuthenticationEntryPointEntityMongo,
	ActiveUserSessionEntityMongo,
	connectToMongoServer,
	clearMongoDatabase,
	closeMongoDatabase,
	failureWillBeGeneratedForEntityOperation,
	clearOperationFailuresForEntities
};
