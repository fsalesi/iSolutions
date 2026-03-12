# QAD DomainMgr Plan

> Purpose: define the v2 QAD integration direction for iSolutions.
> This plan standardizes all QAD/OE access behind a single `DomainMgr` abstraction while keeping the existing OpenEdge backend programs in place.

---

## Decision

iSolutions will introduce a v2 `DomainMgr` as the single gateway for all QAD/OpenEdge calls.

All iSolutions code that needs QAD data must go through this new `DomainMgr`.

We are **not** converting the OpenEdge backend programs.
The existing `be*.p` programs remain the execution layer in OE.

---

## What Stays In OpenEdge

The following remain in OE and are not being ported to TypeScript:
- `beitem.p`
- `besupplier.p`
- `bepo.p`
- other `be*.p` backend programs
- existing QAD business logic implemented inside those programs

The old iPurchase `Be*.cls` files remain a useful reference for:
- procedure inventory
- method naming
- input packing patterns
- output parsing expectations

But they are not the target runtime architecture for iSolutions.

---

## What Gets Rebuilt In iSolutions

### 1. DomainMgr

A new iSolutions-side `DomainMgr` becomes the only transport/gateway layer for QAD calls.

Responsibilities:
- choose the correct PASOE broker by domain
- inject user/domain/context data
- inject QAD credentials from settings
- send `procedure`, `entry`, `input`, and optional `longchar`
- normalize transport errors and timeouts

Out of scope for v2 `DomainMgr`:
- `asproxy.p`
- local `beExecute`
- appserver/local branching
- caching

So the new `DomainMgr` is intentionally simpler than iPurchase's OE `DomainMgr.cls`.

### 2. Be* TypeScript Services

iSolutions will add TypeScript façade classes/services mirroring the purpose of the old `Be*.cls` layer.

Examples:
- `BeSupplierService`
- `BeItemService`
- `BePOService`
- `BeInventoryService`

Responsibilities:
- expose typed methods to the rest of iSolutions
- map those methods to OE `procedure + entry` calls
- pack string/delimited inputs where needed
- translate output payloads into frontend-friendly objects

These services should be thin. They are not the place for transport logic.
They must call the new `DomainMgr`.

### 3. API Routes / UI Layer

Next.js API routes, lookup endpoints, and page services should call the `Be*` services.
They should not call raw PASOE/QAD transport directly.

Target layering:
- page / lookup / route
- `Be*` service
- `DomainMgr`
- PASOE bridge
- existing OE `be*.p`

---

## Folder Structure

QAD integration code in iSolutions should use one main module root:
- `src/lib/qad/`

This folder owns:
- `DomainMgr`
- `Be*` service classes
- shared QAD types
- result mappers
- transport helpers
- utility functions specific to QAD integration

Recommended structure:
- `src/lib/qad/DomainMgr.ts`
- `src/lib/qad/services/`
- `src/lib/qad/types/`
- `src/lib/qad/mappers/`
- `src/lib/qad/utils/`

Lookup UI code does **not** belong under `src/lib/qad`.

QAD-backed lookup presets should live under:
- `src/components/lookup/presets/qad/`

That folder owns UI-facing lookup preset definitions such as:
- vendor lookup
- item lookup
- PO lookup

Next.js HTTP routes remain in their required location:
- `src/app/api/qad/`

So the boundary is:
- `src/lib/qad/` = transport and service layer
- `src/components/lookup/presets/qad/` = UI lookup layer
- `src/app/api/qad/` = HTTP route layer

---

## Existing Starting Point

The current closest equivalent already exists in iSolutions:
- `src/lib/qad/proxy.ts`

Current useful pieces:
- `callQAD(...)`
- `getQADData(...)`

This file already performs most of the transport role we want from the new `DomainMgr`.

So the likely first implementation step is:
- formalize or wrap `callQAD(...)` as `DomainMgr`
- keep the payload contract stable
- move vendor-specific logic to a `BeSupplierService`

---

## Existing Proof Of Pattern

The current Vendor lookup already demonstrates the right final fetch pattern.

Current path:
- `VendorLookup` / `VendorAPI`
- `/api/qad/vendors`
- vendor helper functions
- `callQAD(...)`
- OE `besupplier.p`

That path proves:
- broker resolution by domain works
- PASOE transport works
- OE `be*.p` can remain the backend

What is still too specific today:
- vendor route is hardcoded
- vendor helper functions are not generalized into a reusable `Be*` service layer
- transport is not yet named/owned as `DomainMgr`

---

## v2 DomainMgr Contract

Preferred shape:

```ts
interface DomainMgrCall {
  procedure: string;
  entry?: string;
  input?: string;
  domain: string;
  userId?: string;
  longchar?: string;
}
```

Preferred API:

```ts
DomainMgr.call(params)
DomainMgr.getData(params)
```

Where:
- `call()` is for dedicated `be*.p` procedure calls
- `getData()` is for generic `getData.p` / iBridge calls

---

## Design Rules

### Rule 1
All QAD/OE calls from iSolutions must go through `DomainMgr`.

### Rule 2
UI code must not know PASOE broker details.

### Rule 3
UI code and API routes should prefer `Be*` services over raw `DomainMgr.call(...)`.

### Rule 4
Do not duplicate OE business logic in TypeScript unless there is a deliberate product decision to migrate that logic later.

### Rule 5
Keep `Be*` services thin and focused on method mapping, not transport.

---

## Recommended Build Order

### Phase 1
Create `DomainMgr` in iSolutions as a formal wrapper over the existing QAD proxy transport.

### Phase 2
Create the first `Be*` service in TypeScript using the existing OE backend program.
Recommended first slice:
- `BeSupplierService`

Reason:
- vendor path already exists
- low-risk proof of architecture
- useful immediately for future QAD work

### Phase 3
Move `/api/qad/vendors` to use `BeSupplierService` through the new `DomainMgr`.

### Phase 4
Expand to the next high-value `Be*` service:
- `BeItemService`
- or `BePOService`

---

## Immediate Next Step

Before code changes, inventory the first service surface to formalize.

Recommended first target:
- supplier/vendor methods currently used by iSolutions

That should produce:
- the first v2 `DomainMgr`
- the first `BeSupplierService`
- a clean pattern to repeat for the rest of QAD support
