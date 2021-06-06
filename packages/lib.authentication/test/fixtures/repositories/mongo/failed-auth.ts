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
FailedAuthAttemptSchema.virtual('id').get(function getter() {
	// @ts-ignore
	return String(this._id);
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
				documentQuery.lte(endingTo);
			}
		}

		const docs = await documentQuery.exec();

		return docs.map((doc) => {
			const failedAuthentication = doc.toObject({ virtuals: true }) as FailedAuthenticationModel;
			delete (failedAuthentication as any)._id;
			delete (failedAuthentication as any).__v;

			return failedAuthentication;
		});
	}
};
Object.freeze(FailedAuthenticationAttemptsRepositoryMongo);

export { FailedAuthenticationAttemptsRepositoryMongo };
