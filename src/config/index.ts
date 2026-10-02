/**
 * Epicurrents NCS settings.
 * @package    epicurrents/ncs-module
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { BiosignalAnnotationEvent } from '@epicurrents/core/types'
import type { NcsModuleSettings } from '#types'

const ncsSettings: NcsModuleSettings = {
    events: {
        convertPatterns: [] as [string, BiosignalAnnotationEvent][],
        ignorePatterns: [] as string[],
    },
    // Modality to the list of filter types whose recording-level default propagates to channels of
    // that modality. Without an entry for `'ncs'`, `getChannelFilters` falls back to each channel's
    // own (zero) value, so the filters the runtime module sets on the recording reach no channel.
    //
    // Declaring it does not by itself make an NCS recording filterable: a recording's filters are
    // applied only inside a montage, and this module defines none. See ROADMAP.md.
    filterChannelTypes: {
        ncs: ['highpass', 'lowpass', 'notch'],
    },
    filterPaddingSeconds: 0.1,
    showHiddenChannels: false,
    showMissingChannels: false,
    unloadOnClose: false,
    // A nerve conduction trace is some tens of milliseconds long and arrives already decoded, so a
    // study is a few kilobytes per channel and there is nothing for the manager to page.
    useMemoryManager: false,
}
export default ncsSettings
