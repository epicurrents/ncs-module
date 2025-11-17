/**
 * Nerve Conduction Study (NCS) channel marker.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalChannelMarker } from '@epicurrents/core'
import type { BiosignalChannel } from '@epicurrents/core/dist/types'

export default class NcsChannelMarker extends GenericBiosignalChannelMarker {

    constructor (
        name: string,
        channel: BiosignalChannel,
        label: string,
        position?: number | null,
        value?: number | null
    ) {
        super(name, channel, label, position, value)
    }

    get label () {
        return ((this.position || 0)*1000).toFixed(1)
    }

    setPosition (position: number | null): void {
        this.position = position
        if (position === null) {
            this.value = null
            return
        }
        // The value of the marker is its amplitude value at the given position.
        if (this.channel.signal) {
            // Find the nearest value in the signal array.
            const index = Math.round(position*this.channel.samplingRate)
            if (index >= 0 && index < this.channel.signal.length) {
                this.value = this.channel.signal[index]
            } else {
                this.value = null
            }
        }
    }
}
