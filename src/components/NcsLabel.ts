/**
 * Epicurrents NCS label.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { ResourceLabel } from '@epicurrents/core'
import type { AnnotationLabelTemplate, AnnotationOptions } from '@epicurrents/core/types'

const SCOPE = 'NcsLabel'

export default class NcsLabel extends ResourceLabel {

    /**
     * Build a label from the template *tpl*.
     *
     * Every option is forwarded with `??` rather than `||`, because the annotation constructors read
     * an absent option as a request for the default: `visible` resolves to `true` when it is absent,
     * so a template marking a label hidden produces a visible one under `||`, which maps `false` to
     * absent. The remaining falsy-capable options resolve to the same value either way, and are
     * forwarded the same so the next one added is not the exception.
     * @param tpl - The template to copy.
     */
    public static fromTemplate (tpl: AnnotationLabelTemplate) {
        return new NcsLabel(tpl.value, {
            annotator: tpl.annotator ?? undefined,
            class: tpl.class ?? undefined,
            codes: tpl.codes ?? undefined,
            label: tpl.label ?? undefined,
            locked: tpl.locked ?? undefined,
            priority: tpl.priority ?? undefined,
            text: tpl.text ?? undefined,
            visible: tpl.visible ?? undefined,
        })
    }

    constructor (
        // Required properties:
        value: boolean | number | number[] | string | string[] | null,
        // Optional properties:
        options?: AnnotationOptions
    ) {
        super(SCOPE, value, options)
    }
}
