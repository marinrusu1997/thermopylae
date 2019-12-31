import { before, after } from 'mocha';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AccessPointEntity, AccountEntity, ActiveUserSessionEntity, FailedAuthAttemptsEntity } from '../../lib/models/entities';

const mongod = new MongoMemoryServer();

// see https://stackoverflow.com/questions/39035634/mocha-watch-and-mongoose-models
function getMongoModel(name: string, schema: mongoose.Schema): mongoose.Model<mongoose.Document> {
	return mongoose.models[name] // Check if the model exists
		? mongoose.model(name) // If true, only retrieve it
		: mongoose.model(name, schema); // If false, define it
}

const Models = {
	ACCOUNT: 'account',
	FAILED_AUTH_ATTEMPT: 'failed_auth_attempt',
	ACCESS_POINT: 'access_point',
	ACTIVE_USER_SESSION: 'active_user_session'
};

/* Account */
const AccountSchema = new mongoose.Schema({
	username: { type: String, required: true },
	password: { type: String, required: true },
	salt: { type: String },
	role: { type: String },
	email: { type: String, required: true },
	mobile: { type: String, required: true },
	activated: { type: Boolean, required: true },
	locked: { type: Boolean, required: true },
	mfa: { type: Boolean, required: true }
});
const AccountEntityMongo: AccountEntity = {
	create: async account => {
		const accountModel = await getMongoModel(Models.ACCOUNT, AccountSchema).create(account);
		return {
			...account,
			id: String(accountModel._id)
		};
	},
	read: async username => {
		const accountModel = await getMongoModel(Models.ACCOUNT, AccountSchema)
			.find({ username })
			.exec();
		if (!accountModel) {
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
			mobile: accountModel[0].mobile,
			// @ts-ignore
			activated: accountModel[0].activated,
			// @ts-ignore
			locked: accountModel[0].locked,
			// @ts-ignore
			mfa: accountModel[0].mfa
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
			mobile: accountModel.mobile,
			// @ts-ignore
			activated: accountModel.activated,
			// @ts-ignore
			locked: accountModel.locked,
			// @ts-ignore
			mfa: accountModel.mfa
		};
	},
	activate: _id =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { activated: true })
			.exec(),
	lock: _id =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { locked: true })
			.exec(),
	requireMfa: (_id, required) =>
		getMongoModel(Models.ACCOUNT, AccountSchema)
			.updateOne({ _id }, { mfa: required })
			.exec()
};

/* Failed Auth Attempts */
const FailedAuthAttemptSchema = new mongoose.Schema({
	accountId: { type: String, required: true },
	timestamp: { type: Number, required: true },
	devices: { type: String, required: true },
	ips: { type: String, required: true }
});
const FailedAuthAttemptsEntityMongo: FailedAuthAttemptsEntity = {
	create: attempts =>
		getMongoModel(Models.FAILED_AUTH_ATTEMPT, FailedAuthAttemptSchema)
			.create(attempts)
			.then(doc => String(doc._id)),
	readRange: async (accountId, startingFrom, endingTo) => {
		const docs = await getMongoModel(Models.FAILED_AUTH_ATTEMPT, FailedAuthAttemptSchema)
			.find({ accountId })
			.where('timestamp')
			.gte(startingFrom)
			.lt(endingTo)
			.exec();
		return docs.map(doc => ({
			id: String(doc._id),
			// @ts-ignore
			accountId: doc.accountId,
			// @ts-ignore
			timestamp: doc.timestamp,
			// @ts-ignore
			devices: doc.devices,
			// @ts-ignore
			ips: doc.ips
		}));
	}
}; // FIXME it would be nice if this can be stored in ES

/* Access Point */
const AccessPointSchema = new mongoose.Schema({
	id: { type: Number, required: true },
	accountId: { type: String, required: true },
	ip: { type: String, required: true },
	device: { type: String, required: true },
	location: { type: String }
});
const AccessPointEntityMongo: AccessPointEntity = {
	create: async accessPoint => {
		await getMongoModel(Models.ACCESS_POINT, AccessPointSchema).create(accessPoint);
	},
	authBeforeFromThisDevice: (accountId, device) =>
		getMongoModel(Models.ACCESS_POINT, AccessPointSchema)
			.find({ accountId, device })
			.exec()
			.then(docs => docs.length !== 0)
};

/* Active User Session */
const ActiveUserSessionSchema = new mongoose.Schema({
	id: { type: Number, required: true },
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
		const sessionIds = sessionsDocs.map(session => session.id);
		const accessPointsDocs = await getMongoModel(Models.ACCESS_POINT, AccessPointSchema)
			.find({ id: { $in: sessionIds }, accountId })
			.exec();
		return accessPointsDocs.map(accessPointDoc => ({
			id: accessPointDoc.id,
			// @ts-ignore
			accountId: accessPointDoc.accountId,
			// @ts-ignore
			ip: accessPointDoc.ip,
			// @ts-ignore
			device: accessPointDoc.device,
			// @ts-ignore
			location: accessPointDoc.location
		}));
	},
	delete: async id => {
		await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema)
			.deleteOne({ id })
			.exec();
	},
	deleteAll: async accountId => {
		const bulkDelete = await getMongoModel(Models.ACTIVE_USER_SESSION, ActiveUserSessionSchema).deleteMany({ accountId });
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
		deletePromises.push(mongoose.connection.collections[collectionNames[i]].deleteMany({ $where: '1=1' }));
	}

	return Promise.all(deletePromises);
}

// trigger global hooks at the first import in test suite files
before(() => connectToMongoServer());
after(() => closeMongoDatabase());

export { clearMongoDatabase, AccountEntityMongo, FailedAuthAttemptsEntityMongo, AccessPointEntityMongo, ActiveUserSessionEntityMongo };
