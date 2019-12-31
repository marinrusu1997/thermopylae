const TotpTokenSmsTemplate = (totp: string): string => totp;
const MultiFactorAuthFailedTemplate = (data: { ip: string; device: string }): string => JSON.stringify(data);
const AccountLockedTemplate = (data: { cause: string }): string => JSON.stringify(data);
const AuthFromDiffDeviceTemplate = (data: { ip: string; device: string }): string => JSON.stringify(data);
const ActivateAccountTemplate = (data: { token: string }): string => JSON.stringify(data);

export { TotpTokenSmsTemplate, MultiFactorAuthFailedTemplate, AccountLockedTemplate, AuthFromDiffDeviceTemplate, ActivateAccountTemplate };
