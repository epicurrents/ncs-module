/**
 * Epicurrents NCS recording.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalResource } from '@epicurrents/core'
import type { StudyContext } from '@epicurrents/core/dist/types'
import NcsService from '#service/NcsService'
import type {
    NcsNerveSegment,
    NcsResource,
    NcsStimulationSite,
    SupporterNcsStudyType,
} from '#types'
import NcsChannel from '#components/NcsChannel'
import NcsChannelMarker from '#components/NcsChannelMarker'
import { calculateSignalOffsets } from '@epicurrents/core/dist/util'
//import { Log } from 'scoped-event-log'

//const SCOPE = "NcsRecording"
/**
 * Nerve Conduction Study recording.
 */
export default class NcsRecording extends GenericBiosignalResource implements NcsResource {
    static readonly fromSerialized = (template: Partial<NcsResource>) => {
        const resource = new NcsRecording(template.name || 'NCS Recording')
        if (template.id) {
            // Override the generated id with the template id.
            resource._id = template.id
        }
        resource.dataDuration = template.dataDuration || 0
        resource.samplingRate = template.samplingRate || 0
        resource.type = template.type || 'unknown'
        // Map channels.
        let chIdx = 0
        resource._channels = template.channels?.map((ch) => {
            const channel = new NcsChannel(
                ch?.name || `channel_${chIdx++}`,
                ch?.label || `Ch ${chIdx}`,
                ch?.modality || 'ncs',
                ch?.index || 0,
                ch?.averaged || false,
                ch?.samplingRate || 0,
                ch?.unit || 'V',
                ch?.visible ?? true,
            )
            if (ch?.signal) {
                channel.setSignal(ch.signal as Float32Array)
                // Set the signal cache status if not already set.
                if (!resource.signalCacheStatus[1]) {
                    resource.signalCacheStatus[1] = resource.dataDuration
                }
            }
            if (ch?.markers) {
                for (const mrk of ch.markers) {
                    const marker = new NcsChannelMarker(
                        mrk?.name || 'marker',
                        channel,
                        mrk?.label || mrk?.name || 'Marker',
                        mrk?.position,
                        mrk?.value,
                    )
                    channel.addMarkers(marker)
                }
            }
            return channel
        }) || []
        // Set channel offsets.
        calculateSignalOffsets(resource._channels)
        // Map sites.
        resource._sites = template.sites?.map((site) => {
            const stimSite: NcsStimulationSite = {
                amplitude: site?.amplitude || null,
                area: site?.area || null,
                duration: site?.duration || null,
                endLat: site?.endLat || null,
                name: site?.name || '',
                label: site?.label || '',
                nerve: site?.nerve || '',
                peakLat: site?.peakLat || null,
                startLat: site?.startLat || null,
            }
            return stimSite
        }) || []
        resource._segments = template.segments?.map((seg) => {
            const startSite = seg?.startSiteIndex !== undefined ? resource._sites[seg.startSiteIndex] : null
            if (startSite === null) {
                throw new Error(`Invalid start site index in NCS segment template.`)
            }
            const endSite = seg?.endSiteIndex !== undefined ? resource._sites[seg.endSiteIndex] : null
            const segment = {
                amplitudeDiff: seg?.amplitudeDiff || null,
                areaDiff: seg?.areaDiff || null,
                conductionVel: seg?.conductionVel || null,
                distance: seg?.distance || null,
                endSite,
                label: seg?.label || '',
                latencyDiff: seg?.latencyDiff || null,
                name: seg?.name || '',
                nerve: seg?.nerve || '',
                recordingSite: seg?.recordingSite || {
                    name: 'Rec',
                    label: 'Recording Site',
                    type: ['fwave', 'motor'].includes(resource.type) ? 'muscle' : 'nerve',
                },
                startSite,
            }
            return segment
        }) || []
        return resource
    }

    protected _segments: NcsNerveSegment[] = []
    protected _service: NcsService | null = null
    protected _sites: NcsStimulationSite[] = []
    protected _type: SupporterNcsStudyType = 'unknown'

    /**
     * Create a new NCS recording.
     * @param name - Recording name; this will be displayed in the UI.
     * @param source - Recording source as a study context.
     * @param worker - Worker for the NCS service.
     */
    constructor (name: string, worker?: Worker, source?: StudyContext) {
        super(name, 'ncs', source)
        if (worker) {
            this._service = new NcsService(this, worker)
        }
        if (source && this._service) {
            this._state = 'loading'
            this._service.prepareWorker(source).then((response) => {
                if (response.success) {
                    this._state = 'ready'
                } else {
                    this._errorReason = 'Preparing worker failed'
                    this._state = 'error'
                }
            })
        } else {
            this._state = 'ready'
        }
    }

    get segments () {
        return this._segments
    }
    set segments (segments: NcsNerveSegment[]) {
        this._segments = segments
    }

    get sites () {
        return this._sites
    }
    set sites (sites: NcsStimulationSite[]) {
        this._sites = sites
    }

    get type () {
        return this._type
    }
    set type (type: SupporterNcsStudyType) {
        this._setPropertyValue('type', type)
    }

    getMainProperties () {
        const props = super.getMainProperties()
        return props
    }
}
