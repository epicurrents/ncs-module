/**
 * Nerve Conduction Study (NCS) channel marker.
 *
 * The marker's label is its latency in milliseconds, kept in step with its position rather than
 * computed on read, and falling back to the label it was constructed with while it has no position to
 * take one from.
 *
 * Deriving it on read instead would mean overriding `label` with a getter alone, which replaces the
 * accessor pair the base class declares and leaves the property without a setter. Assigning to one of
 * those throws rather than being ignored, so the base class's guarantee that a marker's label can be
 * written has to survive the override.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalChannelMarker } from '@epicurrents/core'
import type { BiosignalChannel } from '@epicurrents/core/types'

/** Latency in milliseconds, at one decimal, as a marker on an NCS trace is labelled. */
const latencyLabel = (position: number) => (position*1000).toFixed(1)

export default class NcsChannelMarker extends GenericBiosignalChannelMarker {

    constructor (
        name: string,
        channel: BiosignalChannel,
        label: string,
        position?: number | null,
        value?: number | null
    ) {
        super(name, channel, label, position, value)
        // The base constructor reaches `setPosition` only when it was given no value, so a marker
        // restored with both already has the label it was passed. Deriving it here too keeps the
        // label a function of the position on every route into the class.
        if (typeof position === 'number' && !Number.isNaN(position)) {
            this.label = latencyLabel(position)
        }
    }

    /**
     * Move the marker, and with it the two things that are read off its position.
     *
     * The label and the value are both derived, so neither may outlive the position they were taken
     * from: a channel that cannot be sampled at the new position clears the value rather than leaving
     * the one measured where the marker used to be, which would read as an amplitude at the new one.
     * A position that is not a usable number leaves the label alone, there being no latency to show.
     * @param position - Position in seconds from the start of the trace, or null to unset.
     */
    setPosition (position: number | null): void {
        this.position = position
        if (position === null || Number.isNaN(position)) {
            this.value = null
            return
        }
        this.label = latencyLabel(position)
        // A sampling rate of zero is a channel whose rate could not be determined, not a channel
        // sampled at its first value: without this guard every position rounds to index 0 and every
        // marker on the channel reports the same amplitude as though it had been measured at its own
        // latency.
        if (!this.channel.signal || !(this.channel.samplingRate > 0)) {
            this.value = null
            return
        }
        const index = Math.round(position*this.channel.samplingRate)
        this.value = index >= 0 && index < this.channel.signal.length
                     ? this.channel.signal[index]
                     : null
    }
}
