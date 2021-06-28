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
AccountSchema.virtual('id').get(function getter() {
	// @ts-ignore
	return String(this._id);
});

function model(): mongoose.Model<mongoose.Document> {
	return getMongoModel('account', AccountSchema);
}

const AccountRepositoryMongo: AccountRepository<AccountWithTotpSecret> = {
	insert: async (account) => {
		const duplicatedFields = await AccountRepositoryMongo.isDuplicate(account);
		if (duplicatedFields != null) {
			return duplicatedFields;
		}

		const accountModel = await model().create(account);
		account.id = String(accountModel._id);

		return null;
	},

	isDuplicate: async (account) => {
		const duplicatedFields: (keyof AccountWithTotpSecret)[] = [];
		const uniqueFields: (keyof AccountWithTotpSecret)[] = ['username', 'email', 'telephone'];
		for (const field of uniqueFields) {
			if (
				(
					await model()
						.find({ [field]: account[field] })
						.exec()
				).length > 0
			) {
				duplicatedFields.push(field);
			}
		}

		return duplicatedFields.length !== 0 ? duplicatedFields : null;
	},

	readById: async (id) => {
		const document = (await model().findById(id).exec()) as any;
		if (!document) {
			return null;
		}

		const accountModel = document.toObject({ virtuals: true }) as AccountWithTotpSecret;
		accountModel.passwordSalt = undefined; // required for deep compare, because AuthEngine sets this field to undefined when using Argon2
		delete (accountModel as any)._id;
		delete (accountModel as any).__v;

		return accountModel;
	},

	readByUsername: async (username) => {
		const documents = await model().find({ username }).exec();
		if (!documents.length) {
			return null;
		}
		if (documents.length > 1) {
			throw new Error(`Expected 1 account to be found for username ${username}`);
		}

		const accountModel = documents[0].toObject({ virtuals: true }) as AccountWithTotpSecret;
		accountModel.passwordSalt = undefined; // required for deep compare, because AuthEngine sets this field to undefined when using Argon2
		delete (accountModel as any)._id;
		delete (accountModel as any).__v;

		return accountModel;
	},

	readByEmail: async (email) => {
		const documents = await model().find({ email }).exec();
		if (!documents.length) {
			return null;
		}
		if (documents.length > 1) {
			throw new Error(`Expected 1 account to be found for email ${email}.`);
		}

		const accountModel = documents[0].toObject({ virtuals: true }) as AccountWithTotpSecret;
		accountModel.passwordSalt = undefined; // required for deep compare, because AuthEngine sets this field to undefined when using Argon2
		delete (accountModel as any)._id;
		delete (accountModel as any).__v;

		return accountModel;
	},

	readByTelephone: async (telephone) => {
		const documents = await model().find({ telephone }).exec();
		if (!documents.length) {
			return null;
		}
		if (documents.length > 1) {
			throw new Error(`Expected 1 account to be found for telephone ${telephone}.`);
		}

		const accountModel = documents[0].toObject({ virtuals: true }) as AccountWithTotpSecret;
		accountModel.passwordSalt = undefined; // required for deep compare, because AuthEngine sets this field to undefined when using Argon2
		delete (accountModel as any)._id;
		delete (accountModel as any).__v;

		return accountModel;
	},

	update: async (_id, update) => {
		await model().updateOne({ _id }, update).exec();
	},

	setDisabledUntil: async (_id, disabledUntil) => {
		await model().updateOne({ _id }, { disabledUntil }).exec();
	},

	changePassword: async (_id, passwordHash, _salt, passwordAlg) => {
		await model().updateOne({ _id }, { passwordHash, passwordAlg }).exec();
	}
};
Object.freeze(AccountRepositoryMongo);

export { AccountRepositoryMongo };
