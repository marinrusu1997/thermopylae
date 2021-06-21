import { AccountModel, AccountToBeRegistered, AuthenticationContext } from '@thermopylae/lib.authentication';
import { HttpRequest, HttpResponse } from '@thermopylae/core.declarations';

type OnSuccessfulAuthentication = (context: AuthenticationContext, req: HttpRequest, res: HttpResponse) => Promise<void>;

type BeforeAccountRegistration<Account extends AccountModel> = (account: AccountToBeRegistered<Account>) => Promise<void>;

export { OnSuccessfulAuthentication, BeforeAccountRegistration };
