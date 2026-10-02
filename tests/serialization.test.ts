/**
 * Tests for `NcsRecording.fromSerialized`.
 *
 * This is the one live route into the class: the NCS studies that exist arrive already decoded, as
 * resource templates handed to the runtime module's `getResourceFromSerialized`, rather than as files
 * a worker opens. So what this path accepts, drops and silently reshapes is what an NCS study is.
 *
 * Two kinds of case here. The site resolution asserts on which segments survive, because a producer
 * marks a site it could not match with a sentinel index rather than by omitting the field. The rest
 * assert on falsy-but-measured values, since `null` means "not measured" in every numeric field of a
 * site or a segment and a measurement of zero has to stay distinguishable from it.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NcsRecording from '../src/NcsRecording'
import { Log } from 'scoped-event-log'
import { installRuntimeGlobal } from './runtimeGlobal'
import type { NcsResource, NcsStimulationSite } from '../src/types'
import type { SourceChannel } from '@epicurrents/core/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

/** The sentinel a producer writes for a site name it could not match; core's `INDEX_NOT_ASSIGNED`. */
const UNMATCHED = -1

const site = (name: string, over: Partial<NcsStimulationSite> = {}) => ({
    name, label: name, nerve: 'median', ...over,
}) as NcsStimulationSite

/**
 * A serialized channel carrying only the members `fromSerialized` reads. The cast is what makes it a
 * stub rather than a fixture: a real `SourceChannel` has twenty more members, none of them read here.
 */
const channel = (over: Record<string, unknown> = {}) => ({
    signal: new Float32Array([0, 1, 2, 3]),
    samplingRate: 4,
    ...over,
}) as unknown as SourceChannel

const template = (over: Record<string, unknown> = {}) => ({
    name: 'Serialized NCS',
    dataDuration: 1,
    samplingRate: 4,
    ...over,
} as unknown as Partial<NcsResource>)

let removeRuntimeGlobal: () => void

beforeEach(() => {
    vi.clearAllMocks()
    removeRuntimeGlobal = installRuntimeGlobal()
})
afterEach(() => {
    removeRuntimeGlobal()
})

describe('resolving the sites a segment is measured between', () => {
    it('keeps a segment whose start and end sites both resolve', () => {
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist'), site('elbow')],
            segments: [{ name: 'wrist-elbow', startSiteIndex: 0, endSiteIndex: 1 }],
        }))
        expect(resource.segments).toHaveLength(1)
        expect(resource.segments[0].startSite.name).toBe('wrist')
        expect(resource.segments[0].endSite?.name).toBe('elbow')
    })

    it('keeps a segment that names no end site, and reports it as null', () => {
        // Null is the documented state for a segment ending at the recording site, so an absent index
        // is a legitimate template rather than an unresolved one.
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist')],
            segments: [{ name: 'distal', startSiteIndex: 0 }],
        }))
        expect(resource.segments).toHaveLength(1)
        expect(resource.segments[0].endSite).toBeNull()
    })

    it('drops a segment whose start site index matched nothing', () => {
        // The sentinel is what a producer writes when a record names a site the study has no entry
        // for. Indexing with it yields undefined, which satisfies neither the non-null type the field
        // declares nor the null a consumer tests for.
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist')],
            segments: [{ name: 'unmatched', startSiteIndex: UNMATCHED, endSiteIndex: UNMATCHED }],
        }))
        expect(resource.segments).toHaveLength(0)
        expect(Log.error).toHaveBeenCalled()
    })

    it('drops a segment whose end site index was given and matched nothing', () => {
        // Rather than reporting it as null: null states that the segment ends at the recording site,
        // so deriving it from a failed lookup turns "could not match" into a claim about anatomy.
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist')],
            segments: [{ name: 'half-matched', startSiteIndex: 0, endSiteIndex: UNMATCHED }],
        }))
        expect(resource.segments).toHaveLength(0)
    })

    it('drops a segment whose site index is past the end of the sites it has', () => {
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist')],
            segments: [{ name: 'out-of-range', startSiteIndex: 7 }],
        }))
        expect(resource.segments).toHaveLength(0)
    })

    it('keeps the segments that resolve when another one does not', () => {
        // Dropping the study over one unmatched site name would lose the signal along with it.
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist'), site('elbow')],
            segments: [
                { name: 'good', startSiteIndex: 0, endSiteIndex: 1 },
                { name: 'bad', startSiteIndex: UNMATCHED },
            ],
        }))
        expect(resource.segments.map(s => s.name)).toEqual(['good'])
    })
})

describe('what a segment carries beyond its sites', () => {
    it('takes the nerve from the start site when the template names none', () => {
        // The field is documented as extracted from the start site, and the one producer sends no
        // nerve on a segment at all, so an empty string here discards a name already held.
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist', { nerve: 'ulnar' }), site('elbow', { nerve: 'ulnar' })],
            segments: [{ name: 's', startSiteIndex: 0, endSiteIndex: 1 }],
        }))
        expect(resource.segments[0].nerve).toBe('ulnar')
    })

    it('prefers a nerve the template does name', () => {
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist', { nerve: 'ulnar' })],
            segments: [{ name: 's', startSiteIndex: 0, nerve: 'median' }],
        }))
        expect(resource.segments[0].nerve).toBe('median')
    })

    it('keeps the indices the segment resolved through', () => {
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist'), site('elbow')],
            segments: [{ name: 's', startSiteIndex: 0, endSiteIndex: 1 }],
        }))
        expect(resource.segments[0]).toMatchObject({ startSiteIndex: 0, endSiteIndex: 1 })
    })

    it('defaults the recording site by study type', () => {
        // A motor or F-wave response is recorded over a muscle, anything else over a nerve.
        const motor = NcsRecording.fromSerialized(template({
            type: 'motor', sites: [site('wrist')], segments: [{ startSiteIndex: 0 }],
        }))
        const sensory = NcsRecording.fromSerialized(template({
            type: 'sensory', sites: [site('wrist')], segments: [{ startSiteIndex: 0 }],
        }))
        expect(motor.segments[0].recordingSite?.type).toBe('muscle')
        expect(sensory.segments[0].recordingSite?.type).toBe('nerve')
    })
})

describe('measured values that happen to be falsy', () => {
    it('keeps a site response measured at zero', () => {
        // An amplitude of zero is a nerve with no response, which is the finding; reporting it as
        // null files a measurement as never taken.
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist', { amplitude: 0, area: 0, startLat: 0 })],
        }))
        expect(resource.sites[0]).toMatchObject({ amplitude: 0, area: 0, startLat: 0 })
    })

    it('keeps a segment conduction velocity measured at zero', () => {
        const resource = NcsRecording.fromSerialized(template({
            sites: [site('wrist'), site('elbow')],
            segments: [{
                name: 's', startSiteIndex: 0, endSiteIndex: 1,
                conductionVel: 0, amplitudeDiff: 0, latencyDiff: 0, distance: 0,
            }],
        }))
        expect(resource.segments[0]).toMatchObject({
            conductionVel: 0, amplitudeDiff: 0, latencyDiff: 0, distance: 0,
        })
    })

    it('reports a value the template left out as null', () => {
        const resource = NcsRecording.fromSerialized(template({ sites: [site('wrist')] }))
        expect(resource.sites[0]).toMatchObject({ amplitude: null, area: null, startLat: null })
    })
})

describe('channels', () => {
    it('numbers the fallback labels by position, not by how many channels were unnamed', () => {
        // A counter advanced only on an unnamed channel never moves when every channel has a name, so
        // every fallback label collides on the first number.
        const resource = NcsRecording.fromSerialized(template({
            channels: [channel({ name: 'a' }), channel({ name: 'b' }), channel({ name: 'c' })],
        }))
        expect(resource.channels.map(c => c.label)).toEqual(['Ch 1', 'Ch 2', 'Ch 3'])
    })

    it('numbers the fallback names by position too', () => {
        const resource = NcsRecording.fromSerialized(template({
            channels: [channel({ name: 'named' }), channel(), channel()],
        }))
        expect(resource.channels.map(c => c.name)).toEqual(['named', 'channel_1', 'channel_2'])
    })

    it('gives each channel its own index when the template declares none', () => {
        const resource = NcsRecording.fromSerialized(template({
            channels: [channel(), channel(), channel()],
        }))
        expect(resource.channels.map(c => c.index)).toEqual([0, 1, 2])
    })

    it('keeps a declared index of zero', () => {
        const resource = NcsRecording.fromSerialized(template({
            channels: [channel({ index: 0 }), channel({ index: 5 })],
        }))
        expect(resource.channels.map(c => c.index)).toEqual([0, 5])
    })

    it('marks the cached range once a channel carries a signal', () => {
        const resource = NcsRecording.fromSerialized(template({ channels: [channel()] }))
        expect(resource.signalCacheStatus[1]).toBe(1)
    })
})
