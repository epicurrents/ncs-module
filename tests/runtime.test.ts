/**
 * Tests for the NCS runtime module's property mutations.
 *
 * Every branch here guards a value before applying it and does nothing when the guard fails, so the
 * cases worth writing are the ones separating "refused and said so" from "accepted and dropped". The
 * filters additionally return promises, and a rejected one has to reach the log rather than the
 * unhandled-rejection handler.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NCS from '../src/runtime'
import { Log } from 'scoped-event-log'
import { installRuntimeGlobal } from './runtimeGlobal'
import type { DataResource, StateManager } from '@epicurrents/core/types'
import type { NcsResource } from '../src/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

/** A resource carrying only the members the mutations read and write. */
const resource = (over: Record<string, unknown> = {}) => ({
    filters: { highpass: 0, lowpass: 0, notch: 0 },
    sensitivity: 1,
    timebase: 1,
    timebaseUnit: 'ms',
    setHighpassFilter: vi.fn().mockResolvedValue(true),
    setLowpassFilter: vi.fn().mockResolvedValue(true),
    setNotchFilter: vi.fn().mockResolvedValue(true),
    ...over,
}) as unknown as NcsResource

const apply = (property: string, value: unknown, res: NcsResource) =>
    NCS.setPropertyValue?.(property, value, res as unknown as DataResource)

let removeRuntimeGlobal: () => void

beforeEach(() => {
    vi.clearAllMocks()
    removeRuntimeGlobal = installRuntimeGlobal()
})
afterEach(() => {
    removeRuntimeGlobal()
})

describe('filters', () => {
    it.each(['highpass', 'lowpass', 'notch'])('applies a %s frequency', (kind) => {
        const res = resource()
        apply(`${kind}-filter`, 30, res)
        const setter = `set${kind[0].toUpperCase()}${kind.slice(1)}Filter` as keyof NcsResource
        expect(res[setter]).toHaveBeenCalledWith(30)
    })

    it('accepts zero, which is how a filter is turned off', () => {
        const res = resource()
        apply('notch-filter', 0, res)
        expect(res.setNotchFilter).toHaveBeenCalledWith(0)
    })

    it('refuses a negative frequency', () => {
        const res = resource()
        apply('highpass-filter', -1, res)
        expect(res.setHighpassFilter).not.toHaveBeenCalled()
    })

    it('refuses a frequency that is not a number', () => {
        const res = resource()
        apply('highpass-filter', '30', res)
        expect(res.setHighpassFilter).not.toHaveBeenCalled()
    })

    it('reports a rejected filter application', async () => {
        // Unhandled, the rejection says nothing while the control that triggered it keeps showing a
        // value that was never applied.
        const res = resource({ setHighpassFilter: vi.fn().mockRejectedValue(new Error('no montage')) })
        apply('highpass-filter', 30, res)
        await vi.waitFor(() => expect(Log.error).toHaveBeenCalled())
    })
})

describe('display properties', () => {
    it('applies a sensitivity', () => {
        const res = resource()
        apply('sensitivity', 5, res)
        expect(res.sensitivity).toBe(5)
    })

    it('refuses a sensitivity of zero, which would scale the trace to nothing', () => {
        const res = resource()
        apply('sensitivity', 0, res)
        expect(res.sensitivity).toBe(1)
    })

    it('applies a timebase', () => {
        const res = resource()
        apply('timebase', 10, res)
        expect(res.timebase).toBe(10)
    })

    it('refuses a timebase of zero', () => {
        const res = resource()
        apply('timebase', 0, res)
        expect(res.timebase).toBe(1)
    })

    it('applies a timebase unit', () => {
        const res = resource()
        apply('timebase-unit', 's', res)
        expect(res.timebaseUnit).toBe('s')
    })

    it('refuses an empty timebase unit', () => {
        const res = resource()
        apply('timebase-unit', '', res)
        expect(res.timebaseUnit).toBe('ms')
    })
})

describe('properties the module does not own', () => {
    it('reports an unknown property rather than dropping it', () => {
        // Accepting one silently makes a misspelled dispatch do nothing and say nothing, which is
        // indistinguishable from a property that is applied and has no visible effect.
        apply('highpas-filter', 30, resource())
        expect(Log.warn).toHaveBeenCalled()
    })

    it('does nothing when there is no resource to apply to', () => {
        expect(() => NCS.setPropertyValue?.('sensitivity', 5)).not.toThrow()
    })

    it('falls back to the active resource when the caller names none', () => {
        // How the interface dispatches: the store knows which resource is active and the mutation
        // does not take one, so a broken fallback makes every control in the module inert.
        const res = resource()
        const state = {
            APP: { activeDataset: { activeResources: [res] } },
        } as unknown as StateManager
        NCS.setPropertyValue?.('sensitivity', 7, undefined, state)
        expect(res.sensitivity).toBe(7)
    })

    it('does nothing when the active dataset holds no resource', () => {
        const state = { APP: { activeDataset: undefined } } as unknown as StateManager
        expect(() => NCS.setPropertyValue?.('sensitivity', 7, undefined, state)).not.toThrow()
    })
})

describe('applyConfiguration', () => {
    it('takes the module name a deployment configures', async () => {
        await NCS.applyConfiguration?.({ moduleName: { full: 'Nervledningshastighet', short: 'NLH' } })
        expect(NCS.moduleName.full).toBe('Nervledningshastighet')
        expect(NCS.moduleName.short).toBe('NLH')
    })
})
