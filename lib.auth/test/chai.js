import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiArrays from 'chai-arrays';

chai.use(chaiArrays);
chai.use(chaiAsPromised);

export default chai;
export { chai };
