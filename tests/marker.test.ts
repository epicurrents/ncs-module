/**
 * Tests for `NcsChannelMarker`.
 *
 * A marker on an NCS trace carries two derived values: the label, which is the latency it sits at in
 * milliseconds, and the value, which is the amplitude the signal has there. Both have to follow the
 * position, and the label additionally has to stay assignable — the base class declares a setter for
 * it, and the generic marker overlay writes it back while a marker is being dragged.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest'
import NcsChannelMarker from '../src/components/NcsChannelMarker'
import type { BiosignalChannel } from '@epicurrents/core/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

/** A channel carrying only what the marker reads off it. */
const chan = (signal: Float32Array | null = new Float32Array([0, 10, 20, 30])) => ({
    samplingRate: 1000,
    signal,
}) as unknown as BiosignalChannel

describe('the label follows the position', () => {
    it('labels a marker with its latency in milliseconds', () => {
        expect(new NcsChannelMarker('m', chan(), 'Marker', 0.0021).label).toBe('2.1')
    })

    it('relabels on a move', () => {
        const marker = new NcsChannelMarker('m', chan(), 'Marker', 0.001)
        marker.setPosition(0.003)
        expect(marker.label).toBe('3.0')
    })

    it('stays assignable', () => {
        // A read-only override drops the setter the base class declares, and assigning to an accessor
        // that has only a getter throws in a module rather than being ignored. The overlay assigns the
        // label back to itself on every drag frame, so the throw lands in the drag handler.
        const marker = new NcsChannelMarker('m', chan(), 'Marker', 0.001)
        expect(() => { marker.label = marker.label }).not.toThrow()
    })
})

describe('the value follows the position', () => {
    it('reads the amplitude at the position', () => {
        const marker = new NcsChannelMarker('m', chan(), 'Marker')
        marker.setPosition(0.002)
        expect(marker.value).toBe(20)
    })

    it('clears the value when the position leaves the signal', () => {
        const marker = new NcsChannelMarker('m', chan(), 'Marker', 0.002)
        marker.setPosition(9)
        expect(marker.value).toBeNull()
    })

    it('clears the value when the position is unset', () => {
        const marker = new NcsChannelMarker('m', chan(), 'Marker', 0.002)
        marker.setPosition(null)
        expect(marker.value).toBeNull()
    })

    it('clears the value when the channel carries no signal', () => {
        // Leaving the previous value in place reports an amplitude measured at a position the marker
        // has moved away from, which reads exactly like a measurement at the new one.
        const marker = new NcsChannelMarker('m', chan(), 'Marker', 0.002)
        expect(marker.value).toBe(20)
        const marked = marker as unknown as { _channel: BiosignalChannel }
        marked._channel = chan(null)
        marker.setPosition(0.003)
        expect(marker.value).toBeNull()
    })

    it('clears the value when the channel has no sampling rate', () => {
        // Every position rounds to index 0 without this, so each marker on the channel reports the
        // first sample as though it had been measured at its own latency.
        const marker = new NcsChannelMarker('m', chan(), 'Marker', 0.002)
        const marked = marker as unknown as { _channel: BiosignalChannel }
        marked._channel = { samplingRate: 0, signal: new Float32Array([0, 10, 20]) } as unknown as BiosignalChannel
        marker.setPosition(0.003)
        expect(marker.value).toBeNull()
    })

    it('keeps the constructed label while it has no position to derive one from', () => {
        expect(new NcsChannelMarker('m', chan(), 'Marker').label).toBe('Marker')
    })

    it('keeps a value it was constructed with', () => {
        expect(new NcsChannelMarker('m', chan(), 'Marker', 0.002, 7).value).toBe(7)
    })
})
