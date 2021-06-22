import { before } from 'mocha';
import { ApiValidator } from '../lib/validator';

const apiValidator = new ApiValidator();

before(() => apiValidator.init('test/fixtures', ['core']));

export { apiValidator };
