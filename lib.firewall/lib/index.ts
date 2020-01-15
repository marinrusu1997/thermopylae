// eslint-disable-next-line import/no-extraneous-dependencies
import { services } from '@marin/lib.utils';

class Firewall {
	static validate(service: services.SERVICES, method: string, data: object): void {}

	static sanitize(data: object): void {}
}

export { Firewall };
