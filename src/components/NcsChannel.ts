/**
 * Nerve Conduction Study (NCS) channel.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericSourceChannel } from '@epicurrents/core'
import type { BiosignalChannel } from '@epicurrents/core/dist/types'

export default class NcsChannel extends GenericSourceChannel {
    constructor (
        name: string,
        label: string,
        modality: string,
        index: number,
        averaged: boolean,
        samplingRate: number,
        unit: string,
        visible: boolean,
        extraProperties: Partial<BiosignalChannel> = {}
    ) {
        super(name, label, modality, index, averaged, samplingRate, unit, visible, extraProperties)
    }
}
