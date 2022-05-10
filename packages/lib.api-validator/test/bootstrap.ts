// eslint-disable-next-line import/no-extraneous-dependencies
import { before } from 'mocha';
import { ApiValidator } from '../lib';

const apiValidator = new ApiValidator();

before(() => apiValidator.init('test/fixtures', ['core']));

export { apiValidator };
