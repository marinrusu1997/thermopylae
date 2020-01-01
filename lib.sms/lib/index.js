import { SMS } from './sms';

/* Singleton */
const instance = new SMS();
Object.freeze(instance);

export default instance;
export { SMS };
