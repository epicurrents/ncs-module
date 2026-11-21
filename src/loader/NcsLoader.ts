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
     * The importer's file worker. A recording asks for it when it loads, not when it is created.
     */
    protected _getFileWorker () {
        return this._studyImporter?.getFileTypeWorker() ?? null
    }

    createListedResource (listing: StudyListing) {
        const ncs = new NcsRecording(listing.name, () => this._getFileWorker())
        // Kept out of `_resources`: that list is what a read study's resource is found in by index, and a listing
        // entered between a read and its `getResource` would take the read study's place.
        return ncs
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
        const context = await super.loadFromDirectory(dir, config)
        if (!context) {
            return null
        }
        context.modality = 'ncs'
        return context
    }

    public async loadFromUrl (
        fileUrl: string,
        config?: ConfigStudyLoader,
        preStudy?: StudyContext
    ): Promise<StudyContext | null> {
        const context = await super.loadFromUrl(fileUrl, config, preStudy)
        if (!context) {
            return null
        }
        context.modality = 'ncs'
        return context
    }
}
