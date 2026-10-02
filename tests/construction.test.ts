/**
 * Tests for the `NcsRecording` constructor's setup path.
 *
 * A recording given a worker and a source commissions its setup from the constructor and reports the
 * outcome through its own state. All three outcomes matter, and the rejecting one most: a commission
 * that rejects with no handler leaves the recording in `loading` for the rest of the session with the
 * cause reported nowhere, which is indistinguishable from a worker that never answered.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NcsRecording from '../src/NcsRecording'
import NcsService from '../src/service/NcsService'
import { Log } from 'scoped-event-log'
import { installRuntimeGlobal } from './runtimeGlobal'
import type { StudyContext } from '@epicurrents/core/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

const worker = () => ({
    addEventListener: () => undefined,
    postMessage: () => undefined,
    removeEventListener: () => undefined,
    terminate: () => undefined,
}) as unknown as Worker

const study = () => ({ name: 'study', files: [] }) as unknown as StudyContext

let removeRuntimeGlobal: () => void

beforeEach(() => {
    vi.clearAllMocks()
    removeRuntimeGlobal = installRuntimeGlobal()
})
afterEach(() => {
    vi.restoreAllMocks()
    removeRuntimeGlobal()
})

describe('a recording with no worker', () => {
    it('is ready immediately', () => {
        // The deserialised case: the signals arrived with the template rather than being read.
        expect(new NcsRecording('NCS').state).toBe('ready')
    })

    it('is ready even when given a source, there being nothing to read it with', () => {
        expect(new NcsRecording('NCS', undefined, study()).state).toBe('ready')
    })
})

describe('a recording with a worker and a source', () => {
    it('reports itself loading until the worker answers', () => {
        vi.spyOn(NcsService.prototype, 'prepareWorker').mockReturnValue(new Promise(() => undefined))
        expect(new NcsRecording('NCS', worker(), study()).state).toBe('loading')
    })

    it('becomes ready when the setup succeeds', async () => {
        vi.spyOn(NcsService.prototype, 'prepareWorker')
            .mockResolvedValue({ success: true, channels: 1, samplingRate: 1 })
        const recording = new NcsRecording('NCS', worker(), study())
        await vi.waitFor(() => expect(recording.state).toBe('ready'))
    })

    it('becomes errored when the setup reports failure', async () => {
        vi.spyOn(NcsService.prototype, 'prepareWorker')
            .mockResolvedValue({ success: false, channels: 0, samplingRate: 0 })
        const recording = new NcsRecording('NCS', worker(), study())
        await vi.waitFor(() => expect(recording.state).toBe('error'))
    })

    it('becomes errored when the setup answers nothing', async () => {
        // Which is what the service does for a study carrying no NCS data file.
        vi.spyOn(NcsService.prototype, 'prepareWorker').mockResolvedValue(null)
        const recording = new NcsRecording('NCS', worker(), study())
        await vi.waitFor(() => expect(recording.state).toBe('error'))
    })

    it('becomes errored and reports the cause when the setup rejects', async () => {
        vi.spyOn(NcsService.prototype, 'prepareWorker').mockRejectedValue(new Error('worker gone'))
        const recording = new NcsRecording('NCS', worker(), study())
        await vi.waitFor(() => expect(recording.state).toBe('error'))
        expect(Log.error).toHaveBeenCalled()
    })
})
