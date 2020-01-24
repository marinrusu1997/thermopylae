import { SmsClient, Options } from './sms-client';
import { ErrorCodes } from './error';

const instance = new SmsClient();
Object.freeze(instance);

export default instance;
export { SmsClient, Options, ErrorCodes };
