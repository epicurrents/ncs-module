/**
 * Epicurrents NCS event.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalEvent } from '@epicurrents/core'
import type {
    AnnotationEventTemplate,
    BiosignalAnnotationEventOptions,
    SettingsColor,
} from '@epicurrents/core/types'

const SCOPE = 'NcsEvent'

export default class NcsEvent extends GenericBiosignalEvent {

    /**
     * Build an event from the template *tpl*.
     *
     * Every option is forwarded with `??` rather than `||`, because the annotation constructors read
     * an absent option as a request for the default, and `||` maps `false` and `0` to absent. Two
     * bite: `visible: false` produces a visible event, and `opacity: 0` is assigned unguarded, so it
     * reaches the renderer as undefined and is drawn at whatever that defaults to. The rest resolve
     * to the same value either way, and are forwarded the same so the next one added is not the
     * exception.
     * @param tpl - The template to copy.
     */
    public static fromTemplate (tpl: AnnotationEventTemplate) {
        return new NcsEvent(
            tpl.start, tpl.duration, GenericBiosignalEvent.labelFromTemplate(tpl),
            {
                annotator: tpl.annotator ?? undefined,
                background: tpl.background ?? undefined,
                channels: tpl.channels ?? undefined,
                class: tpl.class ?? undefined,
                color: tpl.color as SettingsColor ?? undefined,
                codes: tpl.codes ?? undefined,
                label: tpl.label ?? undefined,
                locked: tpl.locked ?? undefined,
                opacity: tpl.opacity ?? undefined,
                priority: tpl.priority ?? undefined,
                text: tpl.text ?? undefined,
                visible: tpl.visible ?? undefined,
            }
        )
    }

    constructor (
        // Required properties:
        start: number, duration: number, label: string,
        // Optional properties:
        options?: BiosignalAnnotationEventOptions
    ) {
        super(SCOPE, start, duration, label, options)
    }
}
