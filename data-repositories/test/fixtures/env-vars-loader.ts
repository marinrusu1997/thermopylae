import { config as dotEnvConfig } from 'dotenv';

const dotEnv = dotEnvConfig();
if (dotEnv.error) {
	throw dotEnv.error;
}
