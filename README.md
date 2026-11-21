Nerve conduction study module for Epicurrents
=============================================

NCS modality support for the Epicurrents viewer: a biosignal resource, its study loader, its worker service, and the annotation components a reader creates on a nerve conduction trace. The module is registered with the application under the `ncs` modality code.

What distinguishes NCS from the continuous biosignal modalities in this family is that a study is **a set of short stimulated responses, not a recording**. A trace is some tens of milliseconds long; the study is a handful of them, together with the measurements taken off them — the response at each stimulation site, and the conduction between pairs of sites.

Installation
------------

```sh
npm install @epicurrents/ncs-module
```

The package declares [@epicurrents/core](../core) and [scoped-event-log](https://github.com/sam-19/scoped-event-log) as peer dependencies; install one copy of each. Core holds the runtime singletons this module registers against, so a second bundled copy would register against a different one.

Public surface
--------------

| Export | What it is |
|---|---|
| `NcsRecording` | The biosignal resource. Owns the channels, the stimulation sites and the nerve segments. |
| `NcsLoader` | Turns a loaded study into an `NcsRecording`, tagging the study with the `ncs` modality. |
| `NcsService` | Commissions and drives the reader worker. |
| `NcsChannel` | A source channel carrying one stimulated response. |
| `NcsChannelMarker` | A latency cursor on a channel, labelled with the latency it sits at. |
| `NcsEvent`, `NcsLabel` | The annotation components, each with a `fromTemplate` constructor. |
| `runtime`, `settings`, `modality` | What `app.registerModule('ncs', …)` consumes. |

The types are re-exported from the package entry and are also reachable at `@epicurrents/ncs-module/types`.

What a study is made of
-----------------------

Three records, and the relationship between them is the point.

A **channel** carries one trace: the response recorded for one stimulus. `NcsChannel` is a source channel, and its markers — `NcsChannelMarker` — are the latency cursors placed on it. A marker's label is the latency it sits at in milliseconds, and its value is the amplitude the trace has there; both follow the position, so moving a marker re-reads the trace rather than keeping what was measured where it used to be.

A **stimulation site** (`NcsStimulationSite`) is the measurement taken at one point along a nerve: the response's amplitude, area, duration, and its onset, peak and end latencies. Every one of those is `number | null`, where `null` means *not measured*. **Zero is a measurement**: a nerve with no response has an amplitude of zero, and a latency at the stimulus artifact is zero.

A **nerve segment** (`NcsNerveSegment`) is the conduction between two sites: the distance between them, the latency and amplitude difference across them, and the conduction velocity that follows. A segment names its sites by index into the study's site list. An index that resolves to no site is not a segment this module will build — see below.

Opening a study
---------------

Two routes exist, and only one of them currently has a producer.

**From a serialized resource.** `NcsRecording.fromSerialized` builds a recording from an already-decoded template: channels carrying their signals, plus the sites and segments. This is the route the application takes through `getResourceFromSerialized`, and it is how every NCS study in this family is opened, because the one producer reads a vendor database over an API rather than parsing a file.

**From a study file.** `NcsLoader` and `NcsService` describe a reader worker opening an NCS data file, the same shape every other modality in this family uses. The loader builds the recording unloaded, from a read study or from a host's listing, and the recording asks for its worker and sets it up only when it loads. No reader in this family currently answers it; the path is a contract to grow into. [ROADMAP.md](ROADMAP.md) covers what deciding its future involves.

### A segment whose sites do not resolve is dropped

A producer that cannot match a segment's site name writes a sentinel index rather than leaving the field out, so an index being present does not mean a site answers to it. Such a segment is discarded, with the reason logged, rather than built with a site missing.

The asymmetry is deliberate. An unresolved **start** site disqualifies the segment because it is what the segment is measured from. An unresolved **end** site disqualifies it too, even though the field is nullable, because `null` there states that the segment ends at the recording site — a claim about where the measurement was taken, which must not be inferred from a lookup that failed. An **absent** end index is that nullable case legitimately, and is kept.

The rest of the study opens normally. Losing a whole nerve conduction study over one unmatched site name would take its signal with it.

Filters
-------

The runtime module accepts highpass, lowpass and notch frequencies and core records them, but **no sample is currently filtered**: signal filtering happens in a montage, and this module defines none. Setting a filter is accepted and has no visible effect on the trace. The open item is in [ROADMAP.md](ROADMAP.md).

Settings
--------

`settings` carries the common biosignal settings. The memory manager is off — an NCS study arrives decoded and is a few kilobytes per channel, so there is nothing to page — and `filterChannelTypes` names `ncs` so that a recording-level filter default would reach the channels once a filtering path exists.
