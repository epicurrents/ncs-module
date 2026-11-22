/**
 * Tests for listing an NCS study and loading it in place, through the real application and the real loader.
 *
 * The loader and core's listing path are driven together because the contract lives between them: which loader
 * method a listing's source is read through, the modality the read has to come back under, and which object the
 * setup runs on. Only the importer is a double, and it is shaped like the real ones: it declares no modalities and
 * fills the study it is handed.
 *
 * @package    epicurrents/ncs-module
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Epicurrents } from '@epicurrents/core'
import type { MediaDataset, StudyContext } from '@epicurrents/core/types'
import NcsRecording from '../src/NcsRecording'
import NcsLoader from '../src/loader/NcsLoader'
import NcsService from '../src/service/NcsService'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

const workerStub = () => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
} as unknown as Worker)

/** An importer that declares no modalities and fills the study it reads, from a URL or from a file. */
const importerDouble = () => {
    const importer = {
        name: 'NcsImporter',
        study: null as StudyContext | null,
        studyLoader: null as unknown,
        getFileTypeWorker: vi.fn(workerStub),
        importFile: vi.fn(async (file: File) => {
            importer.study!.files = [{ file, modality: 'ncs', role: 'data' } as StudyContext['files'][number]]
            return true
        }),
        importUrl: vi.fn(async (url: string) => {
            importer.study!.files = [{ modality: 'ncs', role: 'data', url } as StudyContext['files'][number]]
            return true
        }),
        isSupportedModality: () => false,
        matchName: () => true,
        registerMemoryManager: vi.fn(),
        registerStudy: (study: StudyContext) => {
            importer.study = study
        },
    }
    return importer
}

describe('a listed NCS study', () => {
    let app: Epicurrents
    let dataset: MediaDataset
    let importer: ReturnType<typeof importerDouble>

    beforeEach(() => {
        ;(window as unknown as { __EPICURRENTS__: undefined }).__EPICURRENTS__ = undefined
        app = new Epicurrents()
        app.runtime.APP.datasets.length = 0
        app.runtime.APP.activeDataset = null
        app.registerModule('ncs', { runtime: {}, settings: {} } as never)
        importer = importerDouble()
        app.registerStudyImporter('ncs/url', 'NCS', 'url', new NcsLoader('NcsLoader', importer as never))
        dataset = app.createDataset('dataset', true)
        vi.spyOn(NcsService.prototype, 'prepareWorker')
            .mockResolvedValue({ success: true, channels: 1, samplingRate: 1 })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('is listed as an NCS recording that has read nothing and started no worker', () => {
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: 'blob:ncs' }, { dataset })
        expect(listed).toBeInstanceOf(NcsRecording)
        expect(listed?.isListed).toBe(true)
        expect(importer.importUrl).not.toHaveBeenCalled()
        expect(importer.getFileTypeWorker).not.toHaveBeenCalled()
    })

    it('loads in place on activation, from the study it reads from a URL', async () => {
        const listed = app.listStudy(
            { loader: 'ncs/url', name: 'Listed', options: { authHeader: 'Bearer token' }, source: 'blob:ncs' },
            { dataset }
        )!
        app.runtime.setActiveResource(listed)
        await vi.waitFor(() => expect(listed.state).toBe('ready'))
        expect(dataset.resources.map(ctx => ctx.resource)).toEqual([listed])
        expect(listed.source?.modality).toBe('ncs')
        expect(listed.source?.files[0].url).toBe('blob:ncs')
        expect(importer.getFileTypeWorker).toHaveBeenCalledTimes(1)
        // The load options reach the worker setup, which opens the data file with the authorization header.
        expect(NcsService.prototype.prepareWorker).toHaveBeenCalledWith(
            listed.source, expect.objectContaining({ authHeader: 'Bearer token' })
        )
    })

    it('loads in place from the study it reads from a file', async () => {
        const file = new File(['ncs'], 'study.ncs')
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: file }, { dataset })!
        expect(await listed.load()).toBe(true)
        expect(listed.state).toBe('ready')
        expect(importer.importFile).toHaveBeenCalledTimes(1)
        // Claimed by the loader on the file path too; a study read under another modality is refused.
        expect(listed.source?.modality).toBe('ncs')
        expect(listed.source?.files[0].file).toBe(file)
    })

    it('stays loadable through prepare, which loads rather than reporting an unread recording ready', async () => {
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: 'blob:ncs' }, { dataset })!
        expect(await listed.prepare()).toBe(true)
        expect(importer.importUrl).toHaveBeenCalledTimes(1)
        expect(NcsService.prototype.prepareWorker).toHaveBeenCalledTimes(1)
    })

    it('is left in error, on the same resource, when the read fails', async () => {
        importer.importUrl.mockResolvedValue(false)
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: 'blob:ncs' }, { dataset })!
        expect(await listed.load()).toBe(false)
        expect(listed.state).toBe('error')
        expect(listed.errorReason).toBe('Reading the study failed')
        expect(dataset.resources.map(ctx => ctx.resource)).toEqual([listed])
        expect(importer.getFileTypeWorker).not.toHaveBeenCalled()
    })

    it('is left listed, with the service of the load shut down, when it is unloaded while it loads', async () => {
        let answer = (_response: { success: boolean, channels: number, samplingRate: number }) => {}
        const prepareWorker = vi.spyOn(NcsService.prototype, 'prepareWorker').mockReturnValue(new Promise(resolve => {
            answer = resolve
        }))
        const destroy = vi.spyOn(NcsService.prototype, 'destroy').mockResolvedValue(undefined)
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: 'blob:ncs' }, { dataset })!
        // The buffer release is core's own and not what is being pinned.
        vi.spyOn(listed as NcsRecording, 'releaseBuffers').mockResolvedValue(undefined)
        const loaded = listed.load()
        await vi.waitFor(() => expect(prepareWorker).toHaveBeenCalledTimes(1))
        await listed.unload()
        expect(listed.state).toBe('added')
        answer({ success: true, channels: 1, samplingRate: 1 })
        expect(await loaded).toBe(false)
        expect(listed.state).toBe('added')
        expect(listed.errorReason).toBe('')
        expect(destroy).toHaveBeenCalledTimes(1)
        expect((listed as unknown as { _service: unknown })._service).toBe(null)
    })

    it('is deactivated when its load fails, and loads on a new service when it is selected again', async () => {
        const prepareWorker = vi.mocked(NcsService.prototype.prepareWorker)
            .mockResolvedValueOnce({ success: false, channels: 0, samplingRate: 0 })
        const destroy = vi.spyOn(NcsService.prototype, 'destroy').mockResolvedValue(undefined)
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: 'blob:ncs' }, { dataset })!
        const internals = listed as unknown as { _service: unknown }
        // The buffer release is core's own and not what is being pinned.
        vi.spyOn(listed as NcsRecording, 'releaseBuffers').mockResolvedValue(undefined)
        app.runtime.setActiveResource(listed)
        await vi.waitFor(() => expect(listed.state).toBe('error'))
        expect(listed.errorReason).toBe('Preparing worker failed')
        expect(listed.isActive).toBe(false)
        // Nothing of the failed attempt is left alive.
        expect(destroy).toHaveBeenCalledTimes(1)
        expect(internals._service).toBe(null)
        expect(listed.canRetryLoad).toBe(true)
        app.selectActiveResource(listed)
        expect(listed.state).toBe('loading')
        await vi.waitFor(() => expect(listed.state).toBe('ready'))
        expect(listed.isActive).toBe(true)
        expect(listed.errorReason).toBe('')
        expect(prepareWorker).toHaveBeenCalledTimes(2)
        // The study was read once; the retry set up from the one the recording kept.
        expect(importer.importUrl).toHaveBeenCalledTimes(1)
        expect(importer.getFileTypeWorker).toHaveBeenCalledTimes(2)
        expect(internals._service).toBeInstanceOf(NcsService)
        expect(destroy).toHaveBeenCalledTimes(1)
    })

    it('shuts down its service when it is destroyed', async () => {
        const destroy = vi.spyOn(NcsService.prototype, 'destroy').mockResolvedValue(undefined)
        const listed = app.listStudy({ loader: 'ncs/url', name: 'Listed', source: 'blob:ncs' }, { dataset })!
        vi.spyOn(listed as NcsRecording, 'releaseBuffers').mockResolvedValue(undefined)
        expect(await listed.load()).toBe(true)
        await listed.destroy()
        expect(destroy).toHaveBeenCalledTimes(1)
        expect((listed as unknown as { _service: unknown })._service).toBe(null)
        expect(listed.state).toBe('destroyed')
    })
})
