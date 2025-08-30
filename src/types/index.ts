import type { BiosignalDataService, BiosignalResource } from "@epicurrents/core/dist/types"

export interface NcsDataService extends BiosignalDataService {

}

export type NcsModuleSettings = {

}

export interface NcsResource extends BiosignalResource {
}

export type SetupNcsWorkerResponse = {
    success: boolean
    channels: number
    samplingRate: number
}
