const TotpTokenSmsTemplate = (totp: string): string => totp;
const MultiFactorAuthFailedTemplate = (data: { ip: string; device: string }): string => JSON.stringify(data);
const AccountDisabledTemplate = (data: { cause: string }): string => JSON.stringify(data);
const AuthFromDiffDeviceTemplate = (data: { ip: string; device: string }): string => JSON.stringify(data);
const ActivateAccountTemplate = (data: { token: string }): string => JSON.stringify(data);
const ForgotPasswordTemplateEmail = (data: { token: string }): string => JSON.stringify(data);
const ForgotPasswordTemplateSms = (token: string): string => token;

export {
	TotpTokenSmsTemplate,
	MultiFactorAuthFailedTemplate,
	AccountDisabledTemplate,
	AuthFromDiffDeviceTemplate,
	ActivateAccountTemplate,
	ForgotPasswordTemplateEmail,
	ForgotPasswordTemplateSms
};
