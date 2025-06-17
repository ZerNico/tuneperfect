/**
 * Checks if a key is a printable character that can be typed into a text input
 * @param key - The key string to check
 * @returns true if the key is a printable character, false otherwise
 */
export function isPrintableKey(key: string | undefined): boolean {
  if (!key || key.length !== 1) {
    return false;
  }
  
  // Check if the character is a printable character
  // This includes letters, numbers, punctuation, symbols, and whitespace
  return /^[a-zA-Z0-9\p{L}\p{N}\p{P}\p{S}\p{Z}]$/u.test(key);
} 