/**
 * Tests for the `fromTemplate` constructors of `NcsEvent` and `NcsLabel`.
 *
 * Every option a template carries is forwarded to an annotation constructor that reads an absent
 * option as a request for its default, so the cases that matter are the ones where the template says
 * something falsy on purpose. The rest of the forwarding is covered by one case per constructor,
 * because a field dropped from the list is the other way this goes wrong.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NcsEvent from '../src/components/NcsEvent'
import NcsLabel from '../src/components/NcsLabel'
import { installRuntimeGlobal } from './runtimeGlobal'
import type { AnnotationEventTemplate, AnnotationLabelTemplate } from '@epicurrents/core/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

const eventTemplate = (over: Record<string, unknown> = {}) => ({
    start: 0, duration: 0, label: 'spike', ...over,
}) as unknown as AnnotationEventTemplate

const labelTemplate = (over: Record<string, unknown> = {}) => ({
    value: 'v', ...over,
}) as unknown as AnnotationLabelTemplate

let removeRuntimeGlobal: () => void

beforeEach(() => {
    vi.clearAllMocks()
    removeRuntimeGlobal = installRuntimeGlobal()
})
afterEach(() => {
    removeRuntimeGlobal()
})

describe('NcsEvent.fromTemplate', () => {
    it('keeps an event the template marks hidden', () => {
        // `visible` resolves to true when absent, so forwarding false as absent produces a visible
        // annotation out of a template that asked for a hidden one.
        expect(NcsEvent.fromTemplate(eventTemplate({ visible: false })).visible).toBe(false)
    })

    it('keeps an opacity of zero', () => {
        // Assigned unguarded by the constructor, so an absent opacity reaches the renderer as
        // undefined and is drawn at whatever that defaults to rather than at nothing.
        expect(NcsEvent.fromTemplate(eventTemplate({ opacity: 0 })).opacity).toBe(0)
    })

    it('keeps a priority of zero', () => {
        expect(NcsEvent.fromTemplate(eventTemplate({ priority: 0 })).priority).toBe(0)
    })

    it('keeps an unlocked template unlocked', () => {
        expect(NcsEvent.fromTemplate(eventTemplate({ locked: false })).locked).toBe(false)
    })

    it('forwards the fields a template does set', () => {
        const event = NcsEvent.fromTemplate(eventTemplate({
            start: 0.5, duration: 0.25, annotator: 'rater', text: 'note', visible: true,
        }))
        expect(event).toMatchObject({ start: 0.5, duration: 0.25, annotator: 'rater', text: 'note' })
    })
})

describe('NcsLabel.fromTemplate', () => {
    it('keeps a label the template marks hidden', () => {
        expect(NcsLabel.fromTemplate(labelTemplate({ visible: false })).visible).toBe(false)
    })

    it('keeps a priority of zero', () => {
        expect(NcsLabel.fromTemplate(labelTemplate({ priority: 0 })).priority).toBe(0)
    })

    it('keeps the template value, including a falsy one', () => {
        // The value is the point of a label, and `false` and `0` are among the types it declares.
        expect(NcsLabel.fromTemplate(labelTemplate({ value: false })).value).toBe(false)
        expect(NcsLabel.fromTemplate(labelTemplate({ value: 0 })).value).toBe(0)
    })

    it('forwards the fields a template does set', () => {
        const label = NcsLabel.fromTemplate(labelTemplate({ annotator: 'rater', text: 'note' }))
        expect(label).toMatchObject({ annotator: 'rater', text: 'note' })
    })
})
