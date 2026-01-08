/**
 * Array Move Utility
 * Moves an item from one index to another in an array
 */

/**
 * Move an array item from one position to another
 * @param {Array} array - The array to modify
 * @param {number} from - Source index
 * @param {number} to - Destination index
 * @returns {Array} - New array with item moved
 */
export function arrayMove(array, from, to) {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}
