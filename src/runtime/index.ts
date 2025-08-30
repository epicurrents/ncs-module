/**
 * Epicurrents NCS module.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { logInvalidMutation } from '@epicurrents/core/dist/runtime'
import type {
    DataResource,
    RuntimeResourceModule,
    SafeObject,
    StateManager,
} from '@epicurrents/core/dist/types'
import type { NcsResource } from '#types'

const SCOPE = 'ncs-runtime-module'

const NCS: SafeObject & RuntimeResourceModule = {
    __proto__: null,
    moduleName: {
        code: 'ncs',
        full: 'Nerve Conduction Studies',
        short: 'NCS',
    },
    async applyConfiguration (_config) {

    },
    setPropertyValue (property: string, value: unknown, resource?: DataResource, state?: StateManager) {
        // NCS specific property mutations.
        const activeRes = resource
                          ? resource as NcsResource
                          : state
                            ? state.APP.activeDataset?.activeResources[0] as NcsResource
                            : null
        if (!activeRes) {
            return
        }
        if (property === '') {
            if (typeof value !== 'number') {
                logInvalidMutation(property, value, SCOPE)
                return
            }
        }
    },
}
export default NCS
