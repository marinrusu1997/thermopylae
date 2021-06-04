import type { AccountModel } from '../../lib';

type Account = Required<Omit<AccountModel, 'passwordSalt'>>;
