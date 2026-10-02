/**
 * Epicurrents NCS service.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericBiosignalService } from '@epicurrents/core'
import type { StudyContext, UrlAccessOptions, WorkerResponse } from '@epicurrents/core/types'
import type { NcsDataService, NcsResource, SetupNcsWorkerResponse } from '#types'
import { Log } from 'scoped-event-log'
import { asError } from '#util'

const SCOPE = 'NcsService'

export default class NcsService extends GenericBiosignalService implements NcsDataService {

    get worker () {
        return this._worker
    }

    constructor (recording: NcsResource, worker: Worker) {
        super(recording, worker)
        // The listener slot is synchronous while the handler is not, so the rejection has to be
        // caught here; unhandled, a malformed worker message would be reported nowhere.
        this._worker?.addEventListener('message', (message: MessageEvent) => {
            this.handleMessage(message as WorkerResponse).catch((e: unknown) => {
                Log.error(`Handling a worker message failed.`, SCOPE, asError(e))
            })
        })
    }

    /**
     * Handle a message from the worker.
     *
     * Settling the commission is the base class's work, and delegating to it is the whole contract:
     * `_getCommissionForMessage` only looks an entry up, so a handler that reads it and returns
     * without resolving leaves every awaited commission pending for the life of the study. Setting a
     * worker up never completes, the entry is never released, and nothing reports a failure — the
     * worker answered, and the answer went nowhere.
     * @param message - The message as it arrived from the worker.
     */
    async handleMessage (message: WorkerResponse) {
        const data = message.data
        if (!data) {
            return false
        }
        return super.handleMessage(message)
    }

    /**
     * Commission the worker to open the study's data file.
     *
     * @param study - The study to open; its NCS data file is what the worker is pointed at.
     * @param options - Access options, carrying the authorization header to use for a study held behind one.
     */
    async prepareWorker (study: StudyContext, options?: UrlAccessOptions) {
        // Found rather than indexed: a study reaching this point without an NCS data file cannot be
        // set up, and destructuring the absent entry throws a message naming neither the study nor
        // the role it was looking for.
        const dataFile = study.files.find(f => f.modality === 'ncs' && f.role === 'data')
        if (!dataFile) {
            Log.error(`Study '${study.name}' has no NCS data file to set the worker up with.`, SCOPE)
            return null
        }
        const { file, url } = dataFile
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
