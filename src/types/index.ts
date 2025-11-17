import type { BaseModuleSettings, BiosignalDataService, BiosignalResource } from "@epicurrents/core/dist/types"

export interface NcsDataService extends BiosignalDataService {

}

export type NcsModuleSettings = BaseModuleSettings & {

}

export type NcsNerveSegment = {
    /** Computed amplitude `start`-`end` difference (as a fraction). */
    amplitudeDiff: number | null
    /** Computed area `start`-`end` difference (as a fraction). */
    areaDiff: number | null
    /** Computed conduction velocity (in m/s). */
    conductionVel: number | null
    /** Computed distance (in mm). */
    distance: number | null
    /** The ending site of the nerve segment (null if the recording site is the end site). */
    endSite: NcsStimulationSite | null
    /** Descriptive label for the nerve segment. */
    label: string
    /** Computed latency `start`-`end` difference (in ms). */
    latencyDiff: number | null
    /** Identifying name of the nerve segment. */
    name: string
    /** The nerve associated with the segment (extracted from the starting site). */
    nerve: string
    /** The recording site of the nerve segment. */
    recordingSite: NcsRecordingSite | null
    /** The starting site of the nerve segment. */
    startSite: NcsStimulationSite
    /** Index of the ending site in the resource's sites array. */
    endSiteIndex?: number
    /** Index of the starting site in the resource's sites array. */
    startSiteIndex?: number
}

export type NcsRecordingSite = {
    /** Identifying name of the recording site. */
    name: string
    /** Descriptive label visible to the user. */
    label: string
    /**
     * Type of the anatomical structure being recorded.
     * - 'central': Central nervous system structure (e.g., spinal cord, cortex).
     * - 'muscle': Muscle end plate.
     * - 'nerve': Peripheral nerve.
     */
    type: 'central' | 'muscle' | 'nerve'
}

export interface NcsResource extends BiosignalResource {
    /** The recording sites associated with the NCS resource. */
    sites: NcsStimulationSite[]
    /** The nerve segments associated with the NCS resource. */
    segments: NcsNerveSegment[]
    /** Type of the NCS recording. */
    type: SupporterNcsStudyType
}

export type NcsStimulationSite = {
    /** Response amplitude of the stimulation site (in V). */
    amplitude: number | null
    /** Response area of the stimulation site (in V·s). */
    area: number | null
    /** Response duration (in s). */
    duration: number | null
    /** Response end latency (in s). */
    endLat: number | null
    /** Identifying name of the stimulation site. */
    name: string
    /** The nerve associated with the stimulation site. */
    nerve: string
    /** Descriptive label visible to the user. */
    label: string
    /** Response peak latency (in s). */
    peakLat: number | null
    /** Response start/offset latency (in s). */
    startLat: number | null
}

export type SetupNcsWorkerResponse = {
    success: boolean
    channels: number
    samplingRate: number
}

export type SupporterNcsStudyType = 'fwave' | 'hreflex' | 'motor' | 'sensory' | 'unknown'
                                  /* | 'blink' | 'mep' | 'rns' | 'ssep' // Future types. */
