/**
 * Epicurrents NCS module utilities.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

/**
 * Present *reason* as an `Error`, so a rejection reaches the log with a stack rather than as a bare
 * string. A caught value is only typed as `unknown`, and a rejection carrying a string logs as the
 * absence of an error when it is passed to the logger's error slot unchecked.
 * @param reason - Whatever a catch clause was handed.
 */
export const asError = (reason: unknown) => {
    return reason instanceof Error ? reason : new Error(String(reason))
}
