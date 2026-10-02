# @epicurrents/ncs-module — roadmap

## Closed by the audit pass

- **eslint reads a configuration again.** The flat config was named `.eslint.config.mjs`, with a leading dot, so eslint 9 found nothing and exited pointing at the migration guide — the lint script had never checked a line. The file is now [eslint.config.mjs](eslint.config.mjs), carrying the family rule set. The first successful run reported 22 problems, not the hundreds the carried-in note predicted; that figure was calibrated on acc-module, which is an order of magnitude larger.
- **A sentinel site index is no longer mistaken for a resolved one.** `fromSerialized` guarded on the index being absent while the one producer writes `-1` for a site name it could not match, so a segment reached consumers with `startSite` undefined on a field declared non-null. See [AGENTS.md](AGENTS.md).
- **Measurements of zero survive deserialisation.** Site and segment numbers were forwarded with `||`, which files a zero amplitude, a zero latency or a zero conduction velocity as "not measured".
- **`fromTemplate` no longer turns a falsy option into a default**, so a template marking an annotation hidden produces a hidden one and `opacity: 0` is drawn at zero.
- **Fallback channel names, labels and indices are positional**, so they stay distinct however many channels carry a name, and a channel set that declares no indices does not collapse to index 0.
- **A marker's label is assignable.** It was a read-only `get label` override, which drops the setter the base class declares; assigning to it throws in a module, and the interface's marker overlay assigns it on every drag frame.
- **A marker's value no longer outlives the position it was measured at** when the channel carries no signal.
- **The service delegates to the base handler**, so a commission is settled rather than looked up and dropped. Nothing could previously finish setting an NCS worker up.
- **`prepareWorker` answers a study with no NCS data file** instead of destructuring the empty result of its own filter.
- **The runtime module's cast is on the call rather than its argument**, so the object is checked against `RuntimeResourceModule` rather than inferred as `any`; its three filter setters have rejection handlers; and an unrecognised property is reported rather than accepted and dropped.
- **The module declares the common biosignal settings** its own runtime reads, including the `filterChannelTypes` entry for `ncs`.
- **The package has tests**: 78 of them across seven files, against the placeholder `describe` block it had. The carried-in note said `npm run test` passed on nothing; it in fact exited 1, because the placeholder was named `tests.ts` and the Vitest include matches `*.test.ts`.
- **The entry exports its channel classes and its types.** `NcsChannel` and `NcsChannelMarker` are in the resource's public object graph and were reachable only through a deep path, and no type was re-exported from the entry at all. The study-type union was misspelled `SupporterNcsStudyType`, which is corrected to `SupportedNcsStudyType` — nothing outside the package referred to it, and exporting it for the first time was the moment not to enshrine the typo.
- **Dead manifest entries removed**: `axios` was a runtime dependency every consumer installed and nothing imported, and `dotenv` plus `.env.example` were webpack-era leftovers nothing read.

## The module reaches no edition, and the interface does not declare it

Nothing in the workspace ships NCS. [profiles/full.mjs](../../profiles/full.mjs) leaves the package out deliberately, saying modalities with no registrar would be cloned and built with nothing registering them, and [setup/modules/](../../setup/modules/) has no `ncs.ts`. So the package is built by the workspace sweep and loaded by no edition.

The interface is a different matter: `interface/src/app/modules/ncs/` is a complete store module with a viewer, a controls component and some two hundred lines of settings, and it imports `@epicurrents/ncs-module` **without declaring it as a dependency** — the import resolves only through the workspace symlink. That is the interface's to fix, and it is listed here because this is where someone wiring NCS up will look.

Wiring it up is a registrar in `setup/modules/ncs.ts` plus the package and `activeModules` entry in whichever profile should carry it. Doing so needs a decision about the reader first, since api-reader is the only NCS producer and is not public.

## Filtering is declared and not applied

The runtime module accepts highpass, lowpass and notch frequencies, core stores them and dispatches property-change events, and no sample is filtered: every path that applies a recording's filters runs inside a montage, and this module defines no montage. The `filterChannelTypes` entry now present closes the propagation half of the gap; the montage is the other half.

Whether an NCS trace should be filterable at all is worth settling before building it. The traces are some tens of milliseconds long, and filter padding at both ends of a 50 ms sweep is a different proposition from padding a continuous EEG.

## The worker path has no producer

`NcsLoader` and `NcsService.prepareWorker` describe a reader opening an NCS data file. No worker in the workspace answers an NCS `setup-worker` commission, and nothing marks a study *file* with `modality: 'ncs'` — api-reader's `modality: 'ncs'` is on its study descriptors, which take the deserialiser route instead. The path is covered by tests as the contract it states, not as a route anything travels.

Decide what it is for before extending it. If NCS studies are always going to arrive decoded over an API, the loader and the service are dead weight carrying a maintenance cost; if a file format is coming, the gap is a reader package rather than anything here.

## The segment and site types carry no units in their own right

`NcsStimulationSite` documents amplitude in volts, latencies in seconds and area in volt-seconds, while the interface renders milliseconds and microvolts, and `NcsNerveSegment.distance` is in millimetres beside a `conductionVel` in metres per second. Every conversion is therefore a convention held in whichever component does the arithmetic.

Nothing is wrong today, because api-reader converts on the way in and the one viewer converts on the way out. It is listed because a second producer or a second consumer is where a mixed-unit record of this shape stops being survivable, and because a unit error in a conduction velocity is clinically meaningful and arithmetically invisible.

## Smaller things

- `getMainProperties` overrides the base method to call it and return its result unchanged. The family does this in acc-, eeg- and emg-module too, so it is a placeholder by convention rather than an oversight here; worth either using or removing across the four together.
- The `exports` map declares both `./config` and `./dist/config` (and the same for `runtime` and `types`) for the same files. The interface imports through the `./dist/` spelling, so both are live; one of them should win.
- emg-module's [config module](../emg-module/src/config/index.ts) carries the sentence this package's did, naming `MontageProcessor` as the only place signals are filtered. Core has three `filterSignal` call sites: that one, `GenericBiosignalCascadeMontage` twice, and the amplitude-integrated trend, which filters with its own analysis band rather than the recording's. The conclusion each package draws is still right, but the supporting claim is not.
- `logInvalidMutation` is called with "Value must be a positive number." for the filter branches, which accept zero. The message is wrong in the same way in acc-, eeg- and emg-module, so it is a family-wide wording fix rather than a local one.
- The package declares no `sideEffects` field. Core declares `sideEffects: false`, which is what made the barrel-import question moot family-wide; none of the modules has followed yet, and they are the packages a consumer's bundler has the most to tree-shake from.
- [src/types/shims.d.ts](src/types/shims.d.ts) holds a module docstring and nothing else. It is tracked, compiled and empty; emg-module carries the same file.
