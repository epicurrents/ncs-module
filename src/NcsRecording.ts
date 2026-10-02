/**
 * Epicurrents NCS recording.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalResource } from '@epicurrents/core'
import type { StudyContext } from '@epicurrents/core/types'
import NcsService from '#service/NcsService'
import type {
    NcsNerveSegment,
    NcsResource,
    NcsStimulationSite,
    SupportedNcsStudyType,
} from '#types'
import NcsChannel from '#components/NcsChannel'
import NcsChannelMarker from '#components/NcsChannelMarker'
import { calculateSignalOffsets, INDEX_NOT_ASSIGNED } from '@epicurrents/core/util'
import { Log } from 'scoped-event-log'
import { asError } from '#util'

const SCOPE = 'NcsRecording'

/**
 * Resolve the site at *index*, or null when no site answers to it.
 *
 * A producer marks a site it could not match with `INDEX_NOT_ASSIGNED` rather than by leaving the
 * field out, so the presence of an index says nothing about whether a site exists at it. Indexing an
 * array with that sentinel yields `undefined`, which is neither the site the segment type promises
 * nor the null a consumer tests for, so what decides here is the lookup rather than the index.
 * @param sites - The sites the study declares, in the order the indices count them.
 * @param index - Index into *sites*, absent when the producer named no site at all.
 */
const siteAt = (sites: NcsStimulationSite[], index?: number): NcsStimulationSite | null => {
    if (index === undefined || index === INDEX_NOT_ASSIGNED) {
        return null
    }
    return sites[index] ?? null
}

/**
 * Nerve Conduction Study recording.
 */
export default class NcsRecording extends GenericBiosignalResource implements NcsResource {
    /**
     * Build a recording from an already-decoded *template*.
     *
     * This is the route an NCS study takes in practice: the measurements arrive decoded over an API
     * rather than as a file a worker opens, so the template carries the channels with their signals
     * alongside the sites and segments measured off them.
     *
     * Absent fields take a default, with one distinction held throughout: every numeric field of a
     * site or a segment is defaulted with `??`, because `null` means "not measured" there and a
     * measurement of zero — a response with no amplitude, a nerve that does not conduct — is a
     * finding rather than an absence.
     * @param template - The serialized resource, of which every field is optional.
     */
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
        // Both fallbacks are numbered from the channel's position in the set, so they stay distinct
        // however many channels carry a name of their own. A counter advanced only where a name is
        // missing numbers by how many were unnamed instead, which collides as soon as any is named.
        resource._channels = template.channels?.map((ch, chIdx) => {
            const channel = new NcsChannel(
                ch?.name || `channel_${chIdx}`,
                ch?.label || `Ch ${chIdx + 1}`,
                ch?.modality || 'ncs',
                // A declared index of 0 is the first channel, not a missing index, and a channel set
                // that leaves the field out is in the order it was serialised in.
                ch?.index ?? chIdx,
                ch?.averaged ?? false,
                ch?.samplingRate ?? 0,
                ch?.unit || 'V',
                ch?.visible ?? true,
            )
            if (ch?.signal) {
                channel.setSignal(ch.signal)
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
                // `??` rather than `||` throughout the measured fields: null means "not measured"
                // here, and a response of zero amplitude or a latency at the stimulus artifact are
                // both measurements. Reporting either as absent discards a finding.
                amplitude: site?.amplitude ?? null,
                area: site?.area ?? null,
                duration: site?.duration ?? null,
                endLat: site?.endLat ?? null,
                name: site?.name || '',
                label: site?.label || '',
                nerve: site?.nerve || '',
                peakLat: site?.peakLat ?? null,
                startLat: site?.startLat ?? null,
            }
            return stimSite
        }) || []
        // A segment is dropped rather than repaired when either of its sites fails to resolve, and
        // the two cases are not symmetrical in why.
        //
        // The start site is what the segment is measured from, and the type declares it present, so
        // a segment without one is not a segment. An unresolved *end* site cannot become null
        // either, even though the field is nullable: null states that the segment ends at the
        // recording site, which is a claim about where the measurement was taken. Deriving that
        // claim from a lookup that failed turns a producer's "I could not match this site" into an
        // anatomical assertion nobody made.
        resource._segments = template.segments?.flatMap((seg) => {
            const startSite = siteAt(resource._sites, seg?.startSiteIndex)
            // Absent rather than unmatched: no end site named at all is the nullable case the type
            // documents, so only an index that was given and did not resolve disqualifies a segment.
            const endSite = siteAt(resource._sites, seg?.endSiteIndex)
            const unresolved = !startSite || (seg?.endSiteIndex !== undefined && !endSite)
            if (unresolved) {
                Log.error(
                    `Dropping NCS segment '${seg?.name || '(unnamed)'}': site indices ` +
                    `${String(seg?.startSiteIndex)} and ${String(seg?.endSiteIndex)} do not both ` +
                    `resolve in a study declaring ${resource._sites.length} site(s).`,
                    SCOPE
                )
                return []
            }
            const segment: NcsNerveSegment = {
                // The same measured-zero reasoning as the sites above: a conduction velocity or an
                // amplitude difference of zero is a finding, and `||` would file it as uncomputed.
                amplitudeDiff: seg?.amplitudeDiff ?? null,
                areaDiff: seg?.areaDiff ?? null,
                conductionVel: seg?.conductionVel ?? null,
                distance: seg?.distance ?? null,
                endSite,
                label: seg?.label || '',
                latencyDiff: seg?.latencyDiff ?? null,
                name: seg?.name || '',
                // Taken from the start site when the template names none, which is the derivation the
                // field is documented as carrying. A segment identifies which nerve it measured by
                // the site it was measured from, so leaving it empty discards something already held.
                nerve: seg?.nerve || startSite.nerve,
                recordingSite: seg?.recordingSite || {
                    name: 'Rec',
                    label: 'Recording Site',
                    type: ['fwave', 'motor'].includes(resource.type) ? 'muscle' : 'nerve',
                },
                startSite,
                endSiteIndex: seg?.endSiteIndex,
                startSiteIndex: seg?.startSiteIndex,
            }
            return [segment]
        }) || []
        return resource
    }

    protected _segments: NcsNerveSegment[] = []
    protected _service: NcsService | null = null
    protected _sites: NcsStimulationSite[] = []
    protected _type: SupportedNcsStudyType = 'unknown'

    /**
     * Create a new NCS recording.
     *
     * A recording given both a worker and a source starts its setup here and reports itself loading
     * until the worker answers. One given neither is ready immediately, which is the deserialised
     * case: its signals arrived with the template rather than being read.
     * @param name - Recording name; this will be displayed in the UI.
     * @param worker - Worker to run the NCS service on; without one the recording has no service.
     * @param source - Recording source as a study context; the worker is pointed at its data file.
     */
    constructor (name: string, worker?: Worker, source?: StudyContext) {
        super(name, 'ncs', source)
        if (worker) {
            this._service = new NcsService(this, worker)
        }
        if (source && this._service) {
            this._state = 'loading'
            // The rejection handler is what makes this a decision rather than a hang: the commission
            // rejects on a worker-reported failure, and without a catch the resource stays in
            // `loading` for the rest of its life with the cause reported nowhere.
            this._service.prepareWorker(source).then((response) => {
                if (response?.success) {
                    this._state = 'ready'
                } else {
                    this._errorReason = 'Preparing worker failed'
                    this._state = 'error'
                }
            }).catch((e: unknown) => {
                Log.error(`Preparing the NCS worker failed.`, SCOPE, asError(e))
                this._errorReason = 'Preparing worker failed'
                this._state = 'error'
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
    set type (type: SupportedNcsStudyType) {
        this._setPropertyValue('type', type)
    }

    getMainProperties () {
        const props = super.getMainProperties()
        return props
    }
}
