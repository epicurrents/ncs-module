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
} from '@epicurrents/core/dist/types'
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
                `Cannot construct a NCS resource from given study context; it is missing required properties.`,
            SCOPE)
            return null
        }
        const worker = this._studyImporter?.getFileTypeWorker()
        if (!worker) {
            Log.error(`Study loader does not have a file worker.`, SCOPE)
            return null
        }
        if (!worker) {
            Log.error(`Study loader doesn't have a file type loader.`, SCOPE)
            return null
        }
        const ncs = new NcsRecording(
            this._study.name,
            worker,
            this._study,
        )
        ncs.state = 'loaded'
        ncs.source = this._study
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
        preStudy?: StudyContext | undefined
    ): Promise<StudyContext | null> {
        const context = await super.loadFromUrl(fileUrl, config, preStudy)
        if (!context) {
            return null
        }
        context.modality = 'ncs'
        return context
    }
}
