import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const mongoMemoryServer = new MongoMemoryServer();

// see https://stackoverflow.com/questions/51960171/node63208-deprecationwarning-collection-ensureindex-is-deprecated-use-creat
// mongoose.set('useCreateIndex', true);

// see https://stackoverflow.com/questions/39035634/mocha-watch-and-mongoose-models
function getMongoModel<Schema extends mongoose.Schema>(name: string, schema: Schema) {
	return mongoose.models[name] // Check if the model exists
		? mongoose.model<Schema>(name) // If true, only retrieve it
		: mongoose.model<Schema>(name, schema); // If false, define it
}

/** Connect to the in-memory database. */
async function connectToMongoDatabase(): Promise<mongoose.Mongoose> {
	if (mongoMemoryServer.instanceInfo == null) {
		await mongoMemoryServer.start();
	}

	return mongoose.connect(mongoMemoryServer.getUri(), { timeoutMS: 1_000, connectTimeoutMS: 1_000, socketTimeoutMS: 1_000 });
}

/** Drop database, close the connection and stop mongodb server. */
async function dropMongoDatabase(): Promise<void> {
	await mongoose.connection.dropDatabase();
	await mongoose.connection.close();
	await mongoMemoryServer.stop();
}

/** Remove all the data for all db collections. */
async function clearMongoDatabase(): Promise<void> {
	await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
}

export { connectToMongoDatabase, dropMongoDatabase, clearMongoDatabase, getMongoModel };
