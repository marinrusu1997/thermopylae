import mongoose from 'mongoose';
import type { FailedAuthenticationAttemptsRepository, FailedAuthenticationModel } from '../../../../lib';
import { getMongoModel } from '../../mongodb';

const FailedAuthAttemptSchema = new mongoose.Schema({
	accountId: { type: String, required: true },
	ip: { type: String, required: true },
	device: Object,
	location: Object,
	detectedAt: { type: Number, required: true, unique: true }
});
function model(): mongoose.Model<mongoose.Document> {
	return getMongoModel('failed-authentication', FailedAuthAttemptSchema);
}

const FailedAuthenticationAttemptsRepositoryMongo: FailedAuthenticationAttemptsRepository = {
	insert: async (failedAuthentication) => {
		const failedAuthModel = await model().create(failedAuthentication);
		failedAuthentication.id = String(failedAuthModel._id);
	},
	readRange: async (accountId, startingFrom, endingTo) => {
		const documentQuery = model().find({ accountId });
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
		for (const doc of docs) {
			doc.id = String(doc._id);
		}

		return docs as unknown as FailedAuthenticationModel[];
	}
};
Object.freeze(FailedAuthenticationAttemptsRepositoryMongo);

export { FailedAuthenticationAttemptsRepositoryMongo };
