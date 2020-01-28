import { before } from 'mocha';
import { Firewall } from '../lib';

before(() => Firewall.init('node_modules/@marin/json-schemas/validation', ['core']));
