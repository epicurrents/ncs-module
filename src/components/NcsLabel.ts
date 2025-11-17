/**
 * Epicurrents NCS label.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalLabel } from '@epicurrents/core'
import type {
    AnnotationLabelTemplate,
    BiosignalAnnotationLabel,
} from '@epicurrents/core/dist/types'

//const SCOPE = 'NcsLabel'

export default class NcsLabel extends GenericBiosignalLabel {

    public static fromTemplate (tpl: AnnotationLabelTemplate) {
        return new NcsLabel(
            tpl.label,
            tpl.class, tpl.codes, tpl.priority, tpl.text, tpl.visible
        )
    }

    constructor (
        // Required properties:
        label: string,
        // Optional properties:
        labelClass?: BiosignalAnnotationLabel['class'], codes?: (number | string)[], priority?: number, text?: string,
        visible?: boolean
    ) {
        super(
            'NcsLabel', label,
            labelClass, codes, priority, text, visible
        )
    }
}
