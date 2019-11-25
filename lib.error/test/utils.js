/**
 * Pauses the invoking function for specified amount of milliseconds
 *
 * @param \{number\} ms Number of milliseconds
 * @return {Promise<any>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  sleep
};

export { sleep };
