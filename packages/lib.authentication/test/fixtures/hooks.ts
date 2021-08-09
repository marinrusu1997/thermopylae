import {
	AccountWithTotpSecret,
	OnAccountDisabledHook,
	OnForgottenPasswordChangedHook,
	OnPasswordChangedHook,
	OnAuthenticationFromDifferentContextHook
} from '../../lib';

const OnAuthFromDifferentContextHookMock: { calls: string[]; hook: OnAuthenticationFromDifferentContextHook<AccountWithTotpSecret> } = {
	calls: [],
	hook: async (account) => {
		OnAuthFromDifferentContextHookMock.calls.push(account.id);
	}
};

const OnAccountDisabledHookMock: { calls: string[]; hook: OnAccountDisabledHook<AccountWithTotpSecret> } = {
	calls: [],
	hook: async (account) => {
		OnAccountDisabledHookMock.calls.push(JSON.stringify(account));
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

export { OnForgottenPasswordChangedHookMock, OnAccountDisabledHookMock, OnAuthFromDifferentContextHookMock, OnPasswordChangedHookMock };
