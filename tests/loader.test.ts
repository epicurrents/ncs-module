/**
 * Tests for `NcsLoader`.
 *
 * The loader's own contribution is narrow: it tags whatever the generic loader produced as an NCS
 * study, and it refuses to build a resource it cannot give a worker. Both are asserted against the
 * base class's result rather than against a real file, since nothing here parses one.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GenericStudyLoader } from '@epicurrents/core'
import NcsLoader from '../src/loader/NcsLoader'
import { Log } from 'scoped-event-log'
import { installRuntimeGlobal } from './runtimeGlobal'
import type { FileFormatImporter, FileSystemItem, StudyContext } from '@epicurrents/core/types'

vi.mock('scoped-event-log', async () => (await import('./logMock')).makeLogMock())

const fakeWorker = () => ({
    addEventListener: () => undefined,
    postMessage: () => undefined,
    removeEventListener: () => undefined,
    terminate: () => undefined,
}) as unknown as Worker

const importer = (over: Record<string, unknown> = {}) => ({
    name: 'ncs-importer',
    getFileTypeWorker: () => null,
    ...over,
}) as unknown as FileFormatImporter

const loaderWith = (over: Record<string, unknown> = {}) => {
    const loader = new NcsLoader('ncs', importer(over))
    return loader
}

let removeRuntimeGlobal: () => void

beforeEach(() => {
    vi.clearAllMocks()
    removeRuntimeGlobal = installRuntimeGlobal()
})
afterEach(() => {
    vi.restoreAllMocks()
    removeRuntimeGlobal()
})

describe('modality', () => {
    it('reports ncs as the resource modality', () => {
        expect(loaderWith().resourceModality).toBe('ncs')
    })

    it('tags a context loaded from a directory', async () => {
        vi.spyOn(GenericStudyLoader.prototype, 'loadFromDirectory')
            .mockResolvedValue({ name: 's', modality: 'unknown' } as unknown as StudyContext)
        const context = await loaderWith().loadFromDirectory({} as FileSystemItem)
        expect(context?.modality).toBe('ncs')
    })

    it('tags a context loaded from a url', async () => {
        vi.spyOn(GenericStudyLoader.prototype, 'loadFromUrl')
            .mockResolvedValue({ name: 's', modality: 'unknown' } as unknown as StudyContext)
        const context = await loaderWith().loadFromUrl('https://example.test/study')
        expect(context?.modality).toBe('ncs')
    })

    it('passes a null context through rather than tagging one that does not exist', async () => {
        vi.spyOn(GenericStudyLoader.prototype, 'loadFromUrl').mockResolvedValue(null)
        await expect(loaderWith().loadFromUrl('https://example.test/study')).resolves.toBeNull()
    })
})

describe('getResource', () => {
    it('answers null when there is no study to build from', async () => {
        vi.spyOn(GenericStudyLoader.prototype, 'getResource').mockResolvedValue(null)
        await expect(loaderWith().getResource()).resolves.toBeNull()
    })

    it('refuses a study the importer can give no worker for', async () => {
        // A recording constructed without one never commissions a setup, so it would sit in its
        // initial state reporting itself loaded.
        vi.spyOn(GenericStudyLoader.prototype, 'getResource').mockResolvedValue(null)
        const loader = loaderWith()
        ;(loader as unknown as { _study: StudyContext })._study = { name: 's' } as StudyContext
        await expect(loader.getResource()).resolves.toBeNull()
        expect(Log.error).toHaveBeenCalledWith(expect.stringContaining('file worker'), expect.anything())
    })

    it('builds a recording from the loaded study and clears it', async () => {
        vi.spyOn(GenericStudyLoader.prototype, 'getResource').mockResolvedValue(null)
        const loader = loaderWith({ getFileTypeWorker: () => fakeWorker() })
        const held = loader as unknown as { _study: StudyContext | null }
        held._study = { name: 'study', files: [] } as unknown as StudyContext
        const resource = await loader.getResource()
        expect(resource?.name).toBe('study')
        // Cleared so a second call does not hand back a resource built from a study already consumed.
        expect(held._study).toBeNull()
    })

    it('refuses a study with no name', async () => {
        vi.spyOn(GenericStudyLoader.prototype, 'getResource').mockResolvedValue(null)
        const loader = loaderWith({ getFileTypeWorker: () => ({}) as Worker })
        ;(loader as unknown as { _study: StudyContext })._study = { name: '' } as StudyContext
        await expect(loader.getResource()).resolves.toBeNull()
        expect(Log.error).toHaveBeenCalledWith(expect.stringContaining('no name'), expect.anything())
    })
})
