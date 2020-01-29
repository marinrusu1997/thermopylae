import { before } from 'mocha';
import { Firewall } from '@marin/lib.firewall';

before(() => Firewall.init('lib/validation', ['core']));
