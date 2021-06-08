import mongoose from 'mongoose';
import objectHash from 'object-hash';
import type { SuccessfulAuthenticationModel, SuccessfulAuthenticationsRepository } from '../../../../lib';
import { getMongoModel } from '../../mongodb';

const SuccessfulAuthenticationSchema = new mongoose.Schema({
	accountId: { type: String, required: true },
	ip: { type: String, required: true },
	device: Object,
	location: Object,
	authenticatedAt: { type: Number, required: true, unique: true }
});
function model(): mongoose.Model<mongoose.Document> {
	return getMongoModel('successful-authentication', SuccessfulAuthenticationSchema);
}

const SuccessfulAuthenticationsRepositoryMongo: SuccessfulAuthenticationsRepository = {
	insert: async (successfulAuthentication) => {
		const doc = await model().create(successfulAuthentication);
		successfulAuthentication.id = String(doc._id);
	},

	readRange: async (accountId, startingFrom, endingTo) => {
		const documentQuery = model().find({ accountId });
		if (startingFrom || endingTo) {
			documentQuery.where('authenticatedAt');
			if (startingFrom) {
				documentQuery.gte(startingFrom);
			}
			if (endingTo) {
				documentQuery.lte(endingTo);
			}
		}

		const docs = await documentQuery.exec();

		return docs.map((doc) => {
			const failedAuthentication = doc.toObject({ virtuals: true }) as SuccessfulAuthenticationModel;
			delete (failedAuthentication as any)._id;
			delete (failedAuthentication as any).__v;

			return failedAuthentication;
		});
	},

	authBeforeFromThisDevice: async (accountId, device) => {
		const prevAuthentications = (await model().find({ accountId }).exec()) as unknown as SuccessfulAuthenticationModel[];
		if (prevAuthentications.length === 0) {
			return true; // this is the first login ever, don't send notification
		}

		const deviceHash = objectHash(device);
		const prevAuthIndex = prevAuthentications.findIndex(
			(prevAuth: SuccessfulAuthenticationModel) => prevAuth.device && objectHash(prevAuth.device) === deviceHash
		);

		return prevAuthIndex !== -1;
	}
};
Object.freeze(SuccessfulAuthenticationsRepositoryMongo);

export { SuccessfulAuthenticationsRepositoryMongo };
