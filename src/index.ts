/**
 * Public surface of the NCS module.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import NcsChannel from '#components/NcsChannel'
import NcsChannelMarker from '#components/NcsChannelMarker'
import NcsEvent from '#components/NcsEvent'
import NcsLabel from '#components/NcsLabel'
import NcsLoader from '#loader/NcsLoader'
import NcsRecording from './NcsRecording'
import NcsService from '#service/NcsService'
import runtime from './runtime'
import settings from './config'

const modality = 'ncs'

export {
    NcsChannel,
    NcsChannelMarker,
    NcsEvent,
    NcsLabel,
    NcsLoader,
    NcsRecording,
    NcsService,
    modality,
    runtime,
    settings,
}
export type {
    NcsDataService,
    NcsModuleSettings,
    NcsNerveSegment,
    NcsRecordingSite,
    NcsResource,
    NcsStimulationSite,
    SetupNcsWorkerResponse,
    SupportedNcsStudyType,
} from '#types'
