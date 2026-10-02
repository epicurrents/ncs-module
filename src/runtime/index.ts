/**
 * Epicurrents NCS module.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { Log } from 'scoped-event-log'
import { logInvalidMutation } from '@epicurrents/core/runtime'
import { safeObjectFrom } from '@epicurrents/core/util'
import { asError } from '#util'
import type {
    DataResource,
    RuntimeResourceModule,
    RuntimeResourceModuleConfig,
    SafeObject,
    StateManager,
} from '@epicurrents/core/types'
import type { NcsResource } from '#types'
import NcsRecording from '../NcsRecording'

const SCOPE = 'ncs-runtime-module'

const NCS = safeObjectFrom({
    moduleName: {
        code: 'ncs',
        full: 'Nerve Conduction Studies',
        short: 'NCS',
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- the contract returns a promise.
    async applyConfiguration (config: RuntimeResourceModuleConfig) {
        // The module name is the only configuration the contract carries; without this handling the
        // name stays at the English default whatever a deployment asks for.
        if (config.moduleName?.full) {
            NCS.moduleName.full = config.moduleName.full
        }
        if (config.moduleName?.short) {
            NCS.moduleName.short = config.moduleName.short
        }
    },
    getResourceFromSerialized (serialized: unknown) {
        return NcsRecording.fromSerialized(serialized as Partial<NcsResource>)
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
        if (property === 'highpass-filter') {
            if (typeof value !== 'number' || value < 0) {
                logInvalidMutation(property, value, SCOPE, 'Value must be a positive number.')
                return
            }
            if (activeRes.filters?.highpass !== undefined) {
                activeRes.setHighpassFilter(value).catch((e: unknown) => {
                    Log.error(`Setting the highpass filter failed.`, SCOPE, asError(e))
                })
            }
        } else if (property === 'lowpass-filter') {
            if (typeof value !== 'number' || value < 0) {
                logInvalidMutation(property, value, SCOPE, 'Value must be a positive number.')
                return
            }
            if (activeRes.filters?.lowpass !== undefined) {
                activeRes.setLowpassFilter(value).catch((e: unknown) => {
                    Log.error(`Setting the lowpass filter failed.`, SCOPE, asError(e))
                })
            }
        } else if (property === 'notch-filter') {
            if (typeof value !== 'number' || value < 0) {
                logInvalidMutation(property, value, SCOPE, 'Value must be a positive number.')
                return
            }
            if (activeRes.filters?.notch !== undefined) {
                activeRes.setNotchFilter(value).catch((e: unknown) => {
                    Log.error(`Setting the notch filter failed.`, SCOPE, asError(e))
                })
            }
        } else if (property === 'sensitivity') {
            if (typeof value !== 'number' || value <= 0) {
                logInvalidMutation(property, value, SCOPE, 'Value must be a positive number.')
                return
            }
            if (activeRes.sensitivity !== undefined) {
                activeRes.sensitivity = value
            }
        } else if (property === 'timebase') {
            if (typeof value !== 'number' || value <= 0) {
                logInvalidMutation(property, value, SCOPE, 'Value must be a positive number.')
                return
            }
            if (activeRes.timebase !== undefined) {
                activeRes.timebase = value
            }
        } else if (property === 'timebase-unit') {
            if (typeof value !== 'string' || value === '') {
                logInvalidMutation(property, value, SCOPE, 'Value must be a non-empty string.')
                return
            }
            if (activeRes.timebaseUnit !== undefined) {
                activeRes.timebaseUnit = value
            }
        } else {
            logInvalidMutation(property, value, SCOPE, 'Unknown property.')
        }
    },
// The cast belongs on the call's result, not on its argument: applied to the object literal it is
// consumed by the parameter type and `safeObjectFrom` hands back `any`, so nothing checks that this
// object satisfies the module contract it is registered under.
}) as SafeObject & RuntimeResourceModule
export default NCS
