import mongoose from 'mongoose';
import type { AccountRepository, AccountWithTotpSecret } from '../../../../lib';
import { getMongoModel } from '../../mongodb';

const AccountSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	passwordHash: { type: String, required: true },
	passwordAlg: { type: Number, required: true },
	email: { type: String, required: true, unique: true },
	telephone: { type: String, required: true, unique: true },
	disabledUntil: { type: Number, required: true },
	mfa: { type: Boolean, required: true },
	pubKey: String,
	totpSecret: String
});
function model(): mongoose.Model<mongoose.Document> {
	return getMongoModel('account', AccountSchema);
}

const AccountRepositoryMongo: AccountRepository<AccountWithTotpSecret> = {
	insert: async (account) => {
		if (await model().exists({ username: account.username })) {
			throw new Error(`Account with username ${account.username} already exists.`);
		}

		const accountModel = await model().create(account);
		account.id = String(accountModel._id);
	},

	readById: async (id) => {
		const accountModel = await model().findById(id).exec();
		if (!accountModel) {
			return null;
		}

		accountModel.id = String(accountModel._id);
		return accountModel as unknown as AccountWithTotpSecret;
	},

	readByUsername: async (username) => {
		const accountModel = await model().find({ username }).exec();
		if (!accountModel.length) {
			return null;
		}
		if (accountModel.length > 1) {
			throw new Error(`Expected 1 account to be found for username ${username}`);
		}

		accountModel[0].id = String(accountModel[0]._id);
		return accountModel[0] as unknown as AccountWithTotpSecret;
	},

	readByEmail: async (email) => {
		const accountModel = await model().find({ email }).exec();
		if (!accountModel.length) {
			return null;
		}
		if (accountModel.length > 1) {
			throw new Error(`Expected 1 account to be found for email ${email}.`);
		}

		accountModel[0].id = String(accountModel[0]._id);
		return accountModel[0] as unknown as AccountWithTotpSecret;
	},

	readByTelephone: async (telephone) => {
		const accountModel = await model().find({ telephone }).exec();
		if (!accountModel.length) {
			return null;
		}
		if (accountModel.length > 1) {
			throw new Error(`Expected 1 account to be found for telephone ${telephone}.`);
		}

		accountModel[0].id = String(accountModel[0]._id);
		return accountModel[0] as unknown as AccountWithTotpSecret;
	},

	setDisabledUntil: async (_id, disabledUntil) => {
		await model().updateOne({ _id }, { disabledUntil }).exec();
	},

	setTwoFactorAuthEnabled: async (_id, mfa) => {
		await model().updateOne({ _id }, { mfa }).exec();
	},

	changePassword: async (_id, passwordHash, _salt, passwordAlg) => {
		await model().updateOne({ _id }, { passwordHash, passwordAlg }).exec();
	}
};
Object.freeze(AccountRepositoryMongo);

export { AccountRepositoryMongo };
