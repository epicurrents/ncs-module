# @epicurrents/ncs-module — architecture notes for AI coding assistants

This file is the entry point for AI coding assistants working in the `@epicurrents/ncs-module` package: nerve conduction study support for the Epicurrents viewer. It is tool-agnostic.

The package follows the study-module pattern that [eeg-module's AGENTS.md](../eeg-module/AGENTS.md) documents as the reference implementation — the same `src/` layout and the same resource / loader / service decomposition. Read that file for the shared pattern, the activation lifecycle and the SAB cache rules; this file covers only what NCS adds, and [README.md](README.md) carries the narrative description of the module's behaviour.

## Toolchain compliance — HIGH PRIORITY

This package depends on `@epicurrents/core` and shares a single toolchain with it. **Never pin package-specific versions that diverge from the canonical set** — a divergent TypeScript produces structurally incompatible `.d.ts` files that type-check locally but corrupt data at runtime, because worker-side and main-thread code can then disagree on data layouts while everything still compiles.

| Tool | Version |
|---|---|
| `@epicurrents/core` | `^2.0.0` |
| TypeScript | `^5.7.0` |
| Vite | `^7.3.1` |
| ESLint | `^9.18.0`, flat config in [eslint.config.mjs](eslint.config.mjs) |
| tsconfig base | extends `@epicurrents/core/tsconfig.base.json` |

`npm run build` produces one artifact, the ESM `dist/`: [vite.config.mjs](vite.config.mjs) emits the JavaScript and `epicurrents-build-types` from core emits the declarations, rewriting their `#` aliases into paths a consumer can resolve. The module has no worker of its own — it drives whichever reader the deployment pairs it with — so it needs no standalone bundle.

The core version appears in three places that must agree: `devDependencies`, `peerDependencies`, and the APIs the source actually calls. The workspace symlinks core rather than installing it, so a stale range type-checks and builds perfectly against whatever version is checked out; only an external consumer sees the mismatch, as a core that lacks the APIs this package calls. Bump the range in the same commit as any change that depends on a new core API.

## The deserialiser is the live path, and the worker path has no producer

An NCS study does not arrive as a file this package parses. The one producer in the family is [api-reader](../api-reader), which reads a Viking database over REST and emits already-decoded resource templates — channels carrying `Float32Array` signals, plus the sites and segments the measurement consists of. Those reach this package through the runtime module's `getResourceFromSerialized`, which is to say through `NcsRecording.fromSerialized`.

`NcsLoader` and `NcsService.prepareWorker` describe the other path, where a reader worker opens an NCS data file. **No worker in the workspace answers an NCS `setup-worker` commission**, and nothing sets `modality: 'ncs'` on a study *file* — api-reader's `modality: 'ncs'` is on its study descriptors. So that path is a shape to grow into, not a route anything currently takes.

The practical consequence for a change here: weight it by which path it is on. A defect in `fromSerialized` affects every NCS study that exists; one in the service affects none of them yet.

## A sentinel index is not an absent index

This is the trap the deserialiser is built around. api-reader resolves a segment's sites by matching names, and writes core's `INDEX_NOT_ASSIGNED` (`-1`) when a name matches nothing — it does not leave the field out. **The presence of an index therefore says nothing about whether a site answers to it**, and `sites[-1]` is `undefined`: neither the site `startSite` is declared to hold nor the `null` a consumer tests for.

`siteAt` in [src/NcsRecording.ts](src/NcsRecording.ts) makes the lookup the decision rather than the index, and a segment whose sites do not both resolve is dropped with a log rather than repaired. The asymmetry in that rule is deliberate and worth keeping:

- An unresolved **start** site disqualifies the segment, because it is what the segment is measured from and the type declares it present.
- An unresolved **end** site disqualifies it too, even though the field is nullable, because `null` there means *the segment ends at the recording site*. That is a claim about where the measurement was taken, and deriving it from a failed lookup turns a producer's "I could not match this" into an anatomical assertion nobody made.
- An **absent** end index is the nullable case the type documents, and is kept.

Dropping the segment rather than the study is the other half: losing a whole nerve conduction study over one unmatched site name would take its signal with it.

## Null means not measured, so zero has to survive

Every numeric field on a site and a segment is `number | null`, and `null` is the "not measured" state. A nerve with no response has an amplitude of **zero**, a latency at the stimulus artifact is **zero**, and a nerve that does not conduct has a conduction velocity of **zero**. All are findings.

So the deserialiser forwards those fields with `??`, never `||`. The same rule governs `fromTemplate` on [NcsEvent](src/components/NcsEvent.ts) and [NcsLabel](src/components/NcsLabel.ts), where the annotation constructors read an absent option as a request for their default: under `||` a template marking an annotation hidden produces a visible one, and `opacity: 0` is assigned unguarded and so reaches the renderer as undefined. The whole option list uses `??`, including the fields where the two operators agree today, so that the next field added is not the exception.

String fields keep `||`, where an empty string and an absent value should both fall back.

## A marker's label is derived, and still has to be assignable

`NcsChannelMarker`'s label is its latency in milliseconds — that is what a cursor on an NCS trace is labelled with. The tempting way to express that is a read-only `get label` override, and it is wrong: the base class declares a getter *and* a setter, a subclass accessor declaration replaces both, and **assigning to an accessor that has only a getter throws in a module** rather than being ignored. The generic marker overlay in the interface writes the label back to itself on every drag frame, so the throw lands inside the drag handler.

The label is therefore kept in step with the position — derived in the constructor and in `setPosition` — rather than computed on read. The value follows the same rule for a different reason: it is the amplitude at the position, so a channel carrying no signal must clear it rather than leave the one measured where the marker used to be, which would read as a measurement at the new position.

## Filters are declared and not applied

The runtime module in [src/runtime/index.ts](src/runtime/index.ts) handles `highpass-filter`, `lowpass-filter` and `notch-filter`, the interface module declares matching actions, and core's setters accept the value and dispatch a property-change event. **No sample is filtered.** Every path that applies a recording's filters runs inside a montage — `MontageProcessor` and `GenericBiosignalCascadeMontage` are the callers of `filterSignal` that read them — and this module defines no montage. Core's one other caller, the amplitude-integrated trend, filters with the band the trend itself asks for rather than with the recording's filters, so it is not a route either.

[src/config/index.ts](src/config/index.ts) declares `filterChannelTypes: { ncs: [...] }`, which closes the half of the gap that was a plain omission — without it core's `getChannelFilters` would not propagate a recording default to an NCS channel even once a filtering path exists. The other half needs a montage. Do not read the presence of the setting as evidence that filtering works; [ROADMAP.md](ROADMAP.md) carries the open item. emg-module is in the identical position and documents it the same way.

## Async boundaries that return void

Each slot below takes a callback whose return value is discarded, so each needs its own rejection handler.

| Site | What is caught |
|---|---|
| `message` listener in `NcsService` | `handleMessage`, which is async while the listener slot is not. |
| `prepareWorker` in `NcsRecording._load` | A rejected setup commission, which resolves the load false with a reason and the cause logged, rather than leaving the rejection to core's generic failure. |
| The three filter setters in the runtime module | A rejected application, which otherwise says nothing while the control that triggered it keeps showing a value that was never applied. |

`@typescript-eslint/no-floating-promises` is on and catches a new branch that forgets one.

## Delegating to the base class is the service's whole contract

`GenericService._getCommissionForMessage` **looks a commission up and does not settle it.** A `handleMessage` override that reads it and returns leaves every awaited commission pending for the life of the study: setting a worker up never completes, the entry is never released, and nothing reports a failure — the worker answered and the answer went nowhere. [NcsService](src/service/NcsService.ts) exists to add nothing and call `super`.

## The cast goes on the call, not on the argument

The runtime module is `safeObjectFrom({ … }) as SafeObject & RuntimeResourceModule`. With the closing parenthesis on the wrong side of the cast — `safeObjectFrom({ … } as SafeObject & RuntimeResourceModule)` — the assertion is consumed by the parameter type, `safeObjectFrom` hands back `any`, and **nothing checks that the object satisfies the contract it is registered under**. Both forms compile and both lint cleanly except for the `no-unsafe-assignment` the `any` triggers at the `const`, which is the only visible sign.

## Internal path aliases

Two alias tables have to agree, and they are not written the same way. [tsconfig.json](tsconfig.json) maps `#*` to `src/*` — a wildcard, so any name resolves. `ALIASES` in [vite.shared.mjs](vite.shared.mjs) enumerates the directories explicitly, because the package declares no `imports` field and an unlisted alias has nothing to fall through to.

The asymmetry means **a new top-level name under `src/` type-checks and fails to build**: `tsc` resolves `#newname` through the wildcard while Vite and Vitest do not. Add the name to the regex in [vite.shared.mjs](vite.shared.mjs) in the same commit that creates it.

## Tests

`npm test` runs two steps: `test:types` type-checks the suite through [tsconfig.test.json](tsconfig.test.json), then `test:unit` runs Vitest. `vitest` and `@vitest/coverage-v8` come from the workspace root rather than this package's own `devDependencies`.

The suite is weighted towards `fromSerialized`, because that is the path NCS studies actually take. Its site-resolution cases assert on *which segments survive*, since every interesting input here is one a producer really emits.

**There are no test doubles for core.** Every case either constructs a real core class or calls a prototype method against a stub carrying only the members that method reads. That is deliberate: a double drifts from the class it stands in for, and a test asserting on a double's property verifies nothing about what the package ships. The type-check step is what keeps it honest, which is why it runs first.

Three things about the test environment, each learned from core rather than from this package:

- **`window.__EPICURRENTS__` has to exist** before any core asset is constructed. `GenericBiosignalResource` reads `window.__EPICURRENTS__.RUNTIME` with the optional chain *after* the object, and `GenericAsset` wants `APP` and `EVENT_BUS` under it. [tests/runtimeGlobal.ts](tests/runtimeGlobal.ts) installs all three.
- **The event bus must be the real one.** `dispatchScopedEvent`'s return value is the before-phase cancellation result, so a stub answering `undefined` makes core's `_setPropertyValue` treat every assignment as prevented — a resource whose fields all silently stay at their defaults. Core re-exports `EventBus`, so using it costs nothing.
- **A `scoped-event-log` mock needs a default export and more than the four levels.** Core's compiled output imports the logger as a default while this package imports it by name, and core's service constructors call `Log.registerWorker`. [tests/logMock.ts](tests/logMock.ts) carries the surface core actually reaches for.

**Test the exported code, not a copy of it.** A test that re-implements the logic it is checking passes regardless of what the production code does, which is worse than no test: it reports coverage of a method it cannot fail on. The corollary for review: when a test file declares a local helper that mirrors a production function, check whether the assertions reach the real one.

## Code comment conventions

Comments and docstrings describe the code's **current contract** — what it does and the invariants it upholds, for a reader who has never seen an earlier version.

- **No change history, migration state or roadmap phases.** Don't narrate what the code used to do or which delivery stage a collaborator belongs to; a reader has no way to date the remark. That belongs in the commit message, where `git blame` surfaces it.
- **Describe the layer's own contract, not its consumers.** State the invariant the layer guarantees so it holds regardless of who calls it.
- **Keep the `@package` / `@copyright` / `@license` header** on every source file.
- **Wrap TypeScript source at a 120-column soft cap** — code, docstrings and comments alike. The one exception: `@param` docstrings stay on a single line regardless of length, because wrapping them renders poorly in the VS Code hover. Do not hard-wrap Markdown prose: one line per paragraph, since docs are read as rendered output at varying widths.
