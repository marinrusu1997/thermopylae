import chai from 'chai';
import chaiArrays from 'chai-arrays';
import chaiDateString from 'chai-date-string';

chai.use(chaiArrays);
chai.use(chaiDateString);

export default chai;
export { chai };
