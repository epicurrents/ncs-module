/**
 * Epicurrents NCS service.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalService } from '@epicurrents/core'
import type { StudyContext, UrlAccessOptions, WorkerResponse } from '@epicurrents/core/dist/types'
import type { NcsDataService, NcsResource, SetupNcsWorkerResponse } from '#types'
//import { Log } from 'scoped-event-log'

//const SCOPE = "NcsService"

export default class NcsService extends GenericBiosignalService implements NcsDataService {

    get worker () {
        return this._worker
    }

    constructor (recording: NcsResource, worker: Worker) {
        super (recording, worker)
        this._worker?.addEventListener('message', this.handleMessage.bind(this))
    }

    async handleMessage (message: WorkerResponse) {
        const data = message.data
        if (!data) {
            return false
        }
        // Responses must have a matching commission.
        const commission = this._getCommissionForMessage(message)
        if (!commission) {
            return false
        }
        return false
    }

    async prepareWorker (study: StudyContext, options?: UrlAccessOptions) {
        // Find the data file.
        const { file, url } = study.files.filter(
            f => f.modality === 'ncs' && f.role === 'data'
        )[0]
        const commission = this._commissionWorker(
            'setup-worker',
            new Map<string, unknown>([
                ['file', file],
                ['url', url],
                ['authHeader', options?.authHeader || null],
            ])
        )
        return commission.promise as Promise<SetupNcsWorkerResponse>
    }
}
