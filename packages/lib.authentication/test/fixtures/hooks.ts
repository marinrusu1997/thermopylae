import { AccountWithTotpSecret, OnAccountDisabledHook, OnForgottenPasswordChangedHook, OnPasswordChangedHook } from '../../lib';

const OnAccountDisabledHookMock: { calls: string[]; hook: OnAccountDisabledHook<AccountWithTotpSecret> } = {
	calls: [],
	hook: async (account) => {
		OnAccountDisabledHookMock.calls.push(account.id);
	}
};

const OnPasswordChangedHookMock: { calls: string[]; hook: OnPasswordChangedHook<AccountWithTotpSecret> } = {
	calls: [],
	hook: async (account) => {
		OnPasswordChangedHookMock.calls.push(account.id);
	}
};

const OnForgottenPasswordChangedHookMock: { calls: string[]; hook: OnForgottenPasswordChangedHook<AccountWithTotpSecret> } = {
	calls: [],
	hook: async (account) => {
		OnForgottenPasswordChangedHookMock.calls.push(account.id);
	}
};

export { OnForgottenPasswordChangedHookMock, OnAccountDisabledHookMock, OnPasswordChangedHookMock };
