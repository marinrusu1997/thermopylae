/**
 * Returns current time in seconds
 * @returns {number}
 */
const nowInSeconds = () => {
	return Math.floor(new Date().getTime() / 1000);
};

export default nowInSeconds;
export { nowInSeconds };
