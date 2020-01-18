import { before } from 'mocha';
import { Firewall } from '../lib';

before(() => Firewall.init());
