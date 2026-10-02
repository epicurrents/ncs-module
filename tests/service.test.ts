/**
 * Tests for `NcsService`.
 *
 * Two contracts, both of which fail quietly rather than loudly. `handleMessage` has to reach the base
 * class, because looking a commission up does not settle it and a handler that stops there leaves
 * every awaited commission pending for the life of the study. And `prepareWorker` has to answer a
 * study with no NCS data file rather than index into the empty result of its own filter.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GenericBiosignalService } from '@epicurrents/core'
import NcsService from '../src/service/NcsService'
import { Log } from 'scoped-event-log'
import { installRuntimeGlobal } from './runtimeGlobal'
import type { NcsResource } from '../src/types'
import type { StudyContext, StudyContextFile, WorkerResponse } from '@epicurrents/core/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

/** A worker stub recording what was posted to it, with no thread behind it. */
const fakeWorker = () => {
    const posted: unknown[] = []
    const listeners: ((e: MessageEvent) => void)[] = []
    const worker = {
        addEventListener: (_type: string, fn: (e: MessageEvent) => void) => { listeners.push(fn) },
        postMessage: (msg: unknown) => { posted.push(msg) },
        removeEventListener: () => undefined,
        terminate: () => undefined,
    }
    return { worker: worker as unknown as Worker, posted, listeners }
}

const recording = () => ({ name: 'NCS', modality: 'ncs' }) as unknown as NcsResource

const studyWith = (...files: Partial<StudyContextFile>[]) => ({
    name: 'study',
    files: files as StudyContextFile[],
}) as unknown as StudyContext

let removeRuntimeGlobal: () => void

beforeEach(() => {
    vi.clearAllMocks()
    removeRuntimeGlobal = installRuntimeGlobal()
})
afterEach(() => {
    removeRuntimeGlobal()
})

describe('handleMessage', () => {
    it('delegates to the base handler', async () => {
        // The base class is where a commission is settled and released; a handler that reads the
        // commission and returns leaves the awaiting caller pending with nothing logged.
        const { worker } = fakeWorker()
        const spy = vi.spyOn(GenericBiosignalService.prototype, 'handleMessage')
            .mockResolvedValue(true)
        const service = new NcsService(recording(), worker)
        const message = { data: { action: 'setup-worker', rn: 1, success: true } } as WorkerResponse
        await expect(service.handleMessage(message)).resolves.toBe(true)
        expect(spy).toHaveBeenCalledWith(message)
        spy.mockRestore()
    })

    it('answers a message with no data without reaching the base handler', async () => {
        const { worker } = fakeWorker()
        const spy = vi.spyOn(GenericBiosignalService.prototype, 'handleMessage')
            .mockResolvedValue(true)
        const service = new NcsService(recording(), worker)
        await expect(service.handleMessage({ data: null } as unknown as WorkerResponse)).resolves.toBe(false)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })

    it('reports a handler rejection rather than losing it', async () => {
        // The listener slot is synchronous and the handler is not, so an unhandled rejection from a
        // malformed message would surface nowhere at all.
        const { worker, listeners } = fakeWorker()
        const service = new NcsService(recording(), worker)
        vi.spyOn(service, 'handleMessage').mockRejectedValue(new Error('malformed'))
        listeners[0]({ data: { action: 'whatever' } } as MessageEvent)
        await vi.waitFor(() => expect(Log.error).toHaveBeenCalled())
    })
})

describe('prepareWorker', () => {
    it('commissions the worker with the NCS data file', async () => {
        const { worker, posted } = fakeWorker()
        const service = new NcsService(recording(), worker)
        void service.prepareWorker(studyWith({ modality: 'ncs', role: 'data', url: 'u' }))
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({ action: 'setup-worker', url: 'u' })
    })

    it('answers null for a study with no NCS data file, and commissions nothing', async () => {
        // Indexing the empty result of the filter instead throws about destructuring undefined, which
        // names neither the study nor the role that was looked for.
        const { worker, posted } = fakeWorker()
        const service = new NcsService(recording(), worker)
        await expect(service.prepareWorker(studyWith())).resolves.toBeNull()
        expect(posted).toHaveLength(0)
        expect(Log.error).toHaveBeenCalled()
    })

    it('does not accept another modality data file as the NCS one', async () => {
        const { worker } = fakeWorker()
        const service = new NcsService(recording(), worker)
        await expect(service.prepareWorker(studyWith({ modality: 'eeg', role: 'data', url: 'u' })))
            .resolves.toBeNull()
    })

    it('does not accept an NCS file in another role', async () => {
        const { worker } = fakeWorker()
        const service = new NcsService(recording(), worker)
        await expect(service.prepareWorker(studyWith({ modality: 'ncs', role: 'meta', url: 'u' })))
            .resolves.toBeNull()
    })

    it('passes the authorization header through when one is given', async () => {
        const { worker, posted } = fakeWorker()
        const service = new NcsService(recording(), worker)
        void service.prepareWorker(
            studyWith({ modality: 'ncs', role: 'data', url: 'u' }),
            { authHeader: 'Bearer t' }
        )
        expect(posted[0]).toMatchObject({ authHeader: 'Bearer t' })
    })
})
