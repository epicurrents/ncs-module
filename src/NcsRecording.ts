/**
 * Epicurrents NCS recording.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalResource } from '@epicurrents/core'
import type { StudyContext } from '@epicurrents/core/dist/types'
import NcsService from '#service/NcsService'
import type { NcsResource } from '#types'
//import { Log } from 'scoped-event-log'

//const SCOPE = "NcsRecording"
/**
 * Nerve Conduction Study recording.
 */
export default class NcsRecording extends GenericBiosignalResource implements NcsResource {
    protected _service: NcsService
    protected _worker?: Worker
    /**
     * Create a new NCS recording.
     * @param name - Recording name; this will be displayed in the UI.
     * @param source - Recording source as a study context.
     * @param worker - Worker for the NCS service.
     */
    constructor (name: string, source: StudyContext, worker: Worker) {
        super(name, 'ncs', source)
        this._service = new NcsService(this, worker)
        this._state = 'loading'
        this._service.prepareWorker(source).then((response) => {
            if (response.success) {
                this._state = 'ready'
            } else {
                this._errorReason = 'Preparing worker failed'
                this._state = 'error'
            }
        })
    }

    getMainProperties () {
        const props = super.getMainProperties()
        return props
    }
}
