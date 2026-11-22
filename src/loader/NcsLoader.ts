/**
 * Epicurrents NCS loader.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericStudyLoader } from '@epicurrents/core'
import type {
    ConfigStudyLoader,
    FileFormatImporter,
    FileSystemItem,
    StudyContext,
    StudyListing,
} from '@epicurrents/core/types'
import { NcsRecording } from '..'
import type { NcsResource } from '#types'
import { Log } from 'scoped-event-log'

const SCOPE = 'NcsLoader'

export default class NcsLoader extends GenericStudyLoader {
    constructor (name: string, importer: FileFormatImporter) {
        super(name, ['ncs'], importer)
    }

    get resourceModality () {
        return 'ncs'
    }

    /**
     * Claim a loaded `study` for the NCS modality. The format importers stamp no modality of their own, and a study
     * read for a listed recording is refused unless it carries the one the recording was listed under, so every
     * loading path claims it.
     */
    protected _claimAsNcs (study: StudyContext | null): StudyContext | null {
        if (!study) {
            return null
        }
        study.modality = 'ncs'
        return study
    }

    /**
     * The importer's file worker. A recording asks for it when it loads, not when it is created.
     */
    protected _getFileWorker () {
        return this._studyImporter?.getFileTypeWorker() ?? null
    }

    createListedResource (listing: StudyListing) {
        // Kept out of `_resources`, which is where a read study's resource is found by index.
        return new NcsRecording(listing.name, () => this._getFileWorker())
    }

    async getResource (idx: number | string = -1): Promise<NcsResource | null> {
        const loaded = await super.getResource(idx)
        if (loaded) {
            return loaded as NcsResource
        } else if (!this._study) {
            return null
        }
        // Create a new resource from the loaded study.
        if (!this._study.name) {
            Log.error(
                `Cannot construct an NCS resource from the given study context; it has no name.`,
                SCOPE
            )
            return null
        }
        // Built unloaded, as a listed recording is: the loader that opened the study loads it straight after.
        const ncs = new NcsRecording(
            this._study.name,
            () => this._getFileWorker(),
            this._study,
        )
        ncs.state = 'loaded'
        this._resources.push(ncs)
        // Clear the loaded study.
        this._study = null
        return ncs
    }

    public async loadFromDirectory (dir: FileSystemItem, config?: ConfigStudyLoader): Promise<StudyContext|null> {
        return this._claimAsNcs(await super.loadFromDirectory(dir, config))
    }

    public async loadFromFile (
        file: File,
        config?: ConfigStudyLoader,
        preStudy?: StudyContext
    ): Promise<StudyContext | null> {
        return this._claimAsNcs(await super.loadFromFile(file, config, preStudy))
    }

    public async loadFromUrl (
        fileUrl: string,
        config?: ConfigStudyLoader,
        preStudy?: StudyContext
    ): Promise<StudyContext | null> {
        return this._claimAsNcs(await super.loadFromUrl(fileUrl, config, preStudy))
    }
}
