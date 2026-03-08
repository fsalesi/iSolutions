# QAD Integration Architecture

> **This document captures the architecture, patterns, and implementation plan for integrating iSolutions with QAD ERP data via PASOE REST services.**

## Table of Contents

- [Overview](#overview)
- [PASOE REST API](#pasoe-rest-api)
- [Proxy Architecture](#proxy-architecture)
- [Service Classes](#service-classes)
- [Vendor Service (First Implementation)](#vendor-service-first-implementation)
- [Lookup Integration](#lookup-integration)
- [File Layout](#file-layout)
- [iPurchase Legacy Reference](#ipurchase-legacy-reference)

---

## Overview

QAD ERP data (vendors, items, accounts, cost centers, sites, etc.) is accessed via PASOE REST endpoints. All QAD calls from iSolutions flow through a **single proxy** that handles connection config, authentication, and transport. Entity-specific **service classes** sit on top of the proxy and own response reshaping and business logic.

### Two Tiers of QAD Calls

| Tier | Mechanism | When to Use | Example |
|------|-----------|-------------|---------|
| **Dedicated BE** | Named procedure + entry | Entity has validation, filtering, or complex logic on the OE side (inactive filtering, AVL checks, etc.) | `besupplier.p / beListSuppliers` |
| **Generic getData.p** | iBridge request with table/where/fields | Simple reference table lookups with no server-side business logic | Cost centers, GL accounts, sites |

---

## PASOE REST API

### Endpoint

```
POST {pasoe_url}/QAD/web/api
Content-Type: application/json
```

The `pasoe_url` is read from the `pasoe_brokers` table in PostgreSQL for the current domain/environment.

### Request Format — Dedicated BE Calls

```json
{
  "procedure": "besupplier.p",
  "entry": "beListSuppliers",
  "input": "CDW",
  "context": {
    "domain": "demo1",
    "userid": "frank",
    "qadUser": "mfg",
    "qadPass": "mfg",
    "dateFormat": "mdy"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `procedure` | string | The .p file on the OE side (e.g. `besupplier.p`, `bepo.p`) |
| `entry` | string | The internal entry point / method name (e.g. `beListSuppliers`, `beGetPODS`). Blank for procedures that don't use entry points (e.g. `getData.p`). |
| `input` | string | Input parameter(s) passed to the procedure. Multiple params are delimited (see BeCaller). |
| `context` | object | Session context — domain, user, QAD credentials (from `QAD_USERNAME`/`QAD_PASSWORD` settings), date format |

### Request Format — Generic getData.p (iBridge)

```json
{
  "procedure": "getData.p",
  "entry": "",
  "input": "",
  "context": {
    "domain": "demo1",
    "userid": "frank",
    "qadUser": "mfg",
    "qadPass": "mfg",
    "dateFormat": "mdy"
  },
  "longchar": "{\"iBridge\":{\"ibRequest\":[{\"dsName\":\"po_mstr\",\"whereClause\":\"po_domain eq \\\"demo1\\\"\",\"numRecords\":10,\"fieldSet\":\"po_nbr,po_stat\",\"outputFormat\":\"json\",\"isQAD\":false}]}}"
}
```

The `longchar` field contains a JSON-encoded iBridge request with:

| Field | Type | Description |
|-------|------|-------------|
| `dsName` | string | QAD table name (e.g. `po_mstr`, `cc_mstr`, `ac_mstr`) |
| `whereClause` | string | Progress 4GL WHERE clause (e.g. `po_domain eq "demo1"`) |
| `numRecords` | number | Max rows to return |
| `fieldSet` | string | Comma-separated column names to include |
| `outputFormat` | string | `"json"` |
| `isQAD` | boolean | `false` for standard tables |

### Response Format — Dedicated BE

Responses return nested ProDataSets serialized as JSON. Parent/child relationships are nested arrays.

**Example: besupplier.p / beListSuppliers**
```json
{
  "ttvd_mstr": [
    {
      "ttvd_domain": "demo1",
      "ttvd_addr": "5004000",
      "ttvd_sort": "CDW",
      "ttvd_buyer": "LLD",
      "ttvd_curr": "USD",
      "ttvd_cr_terms": "2/10-30",
      "ttvd_active": true,
      "ttvd_shipvia": "Fedex",
      "ttvd_pur_acct": "5100",
      "ttvd_pur_cc": "",
      "ttvd_pur_sub": "",
      "ttvd_taxable": false,
      "ttvd_rowid": "...",
      "ttvdad_mstr": [
        {
          "ttad_addr": "5004000",
          "ttad_name": "CDW Corporation",
          "ttad_line1": "200 N Milwaukee Ave",
          "ttad_city": "Vernon Hills",
          "ttad_state": "IL",
          "ttad_zip": "60061",
          "ttad_phone": "847-555-1234",
          "ttad_fax": "",
          "ttad_country": "US"
        }
      ]
    }
  ]
}
```

**Example: bepo.p / beGetPODS**
```json
{
  "ttpo_mstr": [
    {
      "ttpo_nbr": "D133632",
      "ttpo_vend": "5004000",
      "ttpo_vend_name": "CDW",
      "ttpo_buyer": "LLD",
      "ttpo_curr": "USD",
      "ttpo_stat": "",
      "ttpod_det": [
        {
          "ttpod_line": 1,
          "ttpod_part": "22-100",
          "ttpod_pur_cost": 4.00,
          "ttpod_qty_ord": 250.00
        }
      ]
    }
  ]
}
```

### Response Format — Generic getData.p

Flat array keyed by table name:
```json
{
  "po_mstr": [
    { "po_nbr": "D133632", "po_stat": "", "myRowid": "..." },
    { "po_nbr": "D133633", "po_stat": "c", "myRowid": "..." }
  ]
}
```

---

## Proxy Architecture

**All QAD calls go through one proxy.** No exceptions.

### Responsibilities

1. Read PASOE broker config (URL, QAD credentials) from `pasoe_brokers` table
2. Build the POST payload (procedure, entry, input, context, optional longchar)
3. Make the HTTPS POST to `{pasoe_url}/QAD/web/api`
4. Return the raw JSON response
5. Handle errors (connection failures, timeouts, OE error codes)

### Proxy Does NOT

- Reshape or flatten responses — that's the service class's job
- Know about specific entities or business logic
- Cache data (caching can be added later at the service layer if needed)

---

## Service Classes

Entity-specific TypeScript classes that sit on top of the proxy. Each service class mirrors the pattern from the OE side (`BeSupplier.cls`, `BePO.cls`, etc.).

### Responsibilities

1. Know which procedure/entry to call for each operation
2. Flatten nested ProDataSet responses into clean objects
3. Expose typed methods: `listSuppliers(search)`, `getSupplier(code)`, etc.
4. Own any client-side filtering or post-processing

### Pattern

```typescript
// Example: vendor.ts
import { callQAD } from "./proxy";

export async function listSuppliers(search: string, domain: string) {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beListSuppliers",
    input: search,
    domain,
  });
  // Flatten nested dsVD → flat vendor objects
  return (raw.ttvd_mstr || []).map((v: any) => {
    const addr = v.ttvdad_mstr?.[0] || {};
    return {
      vendor_code: v.ttvd_addr,
      vendor_name: v.ttvd_sort,
      city: addr.ttad_city || "",
      state: addr.ttad_state || "",
      // ... any other fields the frontend needs
    };
  });
}

export async function getSupplier(code: string, domain: string) {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beGetSupplier",
    input: code,
    domain,
  });
  const v = raw.ttvd_mstr?.[0];
  if (!v) return null;
  const addr = v.ttvdad_mstr?.[0] || {};
  return {
    vendor_code: v.ttvd_addr,
    vendor_name: v.ttvd_sort,
    buyer: v.ttvd_buyer,
    currency: v.ttvd_curr,
    credit_terms: v.ttvd_cr_terms,
    ship_via: v.ttvd_shipvia,
    default_account: v.ttvd_pur_acct,
    default_cc: v.ttvd_pur_cc,
    default_sub: v.ttvd_pur_sub,
    taxable: v.ttvd_taxable,
    active: v.ttvd_active,
    // Address
    name: addr.ttad_name,
    line1: addr.ttad_line1,
    line2: addr.ttad_line2,
    city: addr.ttad_city,
    state: addr.ttad_state,
    zip: addr.ttad_zip,
    country: addr.ttad_country,
    phone: addr.ttad_phone,
    fax: addr.ttad_fax,
  };
}
```

---

## Vendor Service (First Implementation)

### OE Source: `BeSupplier.cls` → `besupplier.p`

Located at: `com/ISSGroup/iPurchase/BeProxy/BeSupplier.cls`

### Available Methods

| Method | Procedure + Entry | Input | Returns | Purpose |
|--------|-------------------|-------|---------|---------|
| `listSuppliers` | `besupplier.p, beListSuppliers` | search string | `dsVD` (starts-with match on sort name) | Autocomplete — default mode |
| `listSuppliersMatch` | `besupplier.p, beListSuppliersMatch` | search string | `dsVD` (contains match) | Autocomplete — when `SUPPLIER_SEARCH_MATCHES=true` |
| `getSupplier` | `besupplier.p, beGetSupplier` | vendor code | `dsVD` (single record) | Cascade: populate phone, address, terms on selection |
| `getSupplierBySort` | `besupplier.p, beGetSupplierBySort` | sort name | `dsVD` (first match) | Lookup by name |
| `getSupplierByRowid` | `besupplier.p, beGetSupplierByRowid` | rowid string | `dsVD` (single record) | Direct record fetch |
| `getSupplierEmail` | `besupplier.p, beGetSupplierEmail` | vendor code | email string (return value) | Email retrieval |
| `validateSupplierAVL` | `besupplier.p, beValidateSupplierAVL` | vendor code [+ item] | validation result (return value) | AVL validation |

### Dataset: dsVD

**Parent: `ttvd_mstr`** (vendor master)

| Field | Type | Description |
|-------|------|-------------|
| `ttvd_domain` | char | Domain |
| `ttvd_addr` | char | **Vendor code** (primary identifier — this is the address code, not vd_nbr) |
| `ttvd_sort` | char | Vendor sort/display name |
| `ttvd_buyer` | char | Default buyer code |
| `ttvd_curr` | char | Currency |
| `ttvd_cr_terms` | char | Credit terms |
| `ttvd_shipvia` | char | Default ship via |
| `ttvd_pur_acct` | char | Default purchase GL account |
| `ttvd_pur_cc` | char | Default purchase cost center |
| `ttvd_pur_sub` | char | Default purchase sub-account |
| `ttvd_pur_cntct` | char | Purchasing contact |
| `ttvd_type` | char | Vendor type |
| `ttvd_taxable` | logical | Taxable flag |
| `ttvd_active` | logical | Active flag |
| `ttvd_site` | char | Default site (later QAD versions) |
| `ttvd__chr01` | char | Custom field 1 |
| `ttvd__chr02` | char | Custom field 2 |
| `ttvd_rowid` | rowid | QAD ROWID |

**Child: `ttvdad_mstr`** (vendor address, nested under each `ttvd_mstr` record)

Relation: `ttvd_addr = ttad_addr`

| Field | Type | Description |
|-------|------|-------------|
| `ttad_addr` | char | Address code (matches `ttvd_addr`) |
| `ttad_name` | char | Company name |
| `ttad_attn` | char | Attention line 1 |
| `ttad_attn2` | char | Attention line 2 |
| `ttad_line1` | char | Address line 1 |
| `ttad_line2` | char | Address line 2 |
| `ttad_line3` | char | Address line 3 |
| `ttad_city` | char | City |
| `ttad_state` | char | State/Province |
| `ttad_zip` | char | Postal code |
| `ttad_ctry` | char | Country code |
| `ttad_country` | char | Country name |
| `ttad_phone` | char | Phone |
| `ttad_fax` | char | Fax |
| `ttad_sort` | char | Address sort name |
| `ttad_type` | char | Address type |
| `ttad_taxable` | logical | Taxable flag |
| `ttad_rowid` | rowid | QAD ROWID |

### iPurchase Legacy Behavior

From `getsuppliers.p`:
- `SUPPLIER_SEARCH_MATCHES` setting toggles between `listSuppliers` (starts-with) and `listSuppliersMatch` (contains)
- Inactive suppliers filtered out via `{inactivesupplier.i}` — **this filtering happens on the OE side inside the BE**, so the REST response already excludes them
- Deduplicates by `ttad_addr`
- Hard cap at 500 results
- Frontend showed: vendor code + name on line 1, city+state on line 2
- On select: stored vendor code (`ttvd_addr`) and name (`ttvd_sort`), then cascaded `getSupplier()` to populate phone, address, terms, etc.

---

## Lookup Integration

### VendorLookup Preset

```typescript
// src/components/lookup/presets/VendorLookup.ts
export const VendorLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  fetchFn: async ({ search }) => {
    const rows = await listSuppliers(search, currentDomain);
    return { rows, total: rows.length };
  },
  valueField: "vendor_code",
  displayField: "vendor_name",
  dropdownColumns: ["vendor_code", "vendor_name", "city"],
  minChars: 3,
  browsable: true,
  gridColumns: [
    { key: "vendor_code", label: "Code" },
    { key: "vendor_name", label: "Name" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "phone", label: "Phone" },
  ],
  placeholder: "Search vendors...",
  onSelect: (record) => {
    // Cascade: call getSupplier(record.vendor_code) to populate
    // phone, address, credit terms, ship via, default account, etc.
  },
  ...overrides,
});
```

### Generic getData Lookups (Future)

For simple reference tables, lookup presets will call the proxy with `getData.p`:

```typescript
// Example: CostCenterLookup
fetchFn: async ({ search }) => {
  const rows = await getQADData({
    dsName: "cc_mstr",
    whereClause: `cc_domain eq "${domain}" and cc_code begins "${search}"`,
    fieldSet: "cc_code,cc_desc",
    numRecords: 50,
  });
  return { rows, total: rows.length };
}
```

---

## File Layout

```
src/lib/qad/
  proxy.ts              — Single PASOE proxy: callQAD(), getQADData()
  vendor.ts             — listSuppliers(), getSupplier(), getSupplierEmail(), etc.
  (future)
  po.ts                 — getPO(), listPOs()
  item.ts               — getItem(), listItems()
  account.ts            — listAccounts()
  ...

src/components/lookup/presets/
  VendorLookup.ts       — Vendor lookup preset (uses vendor.ts)
  (future)
  CostCenterLookup.ts   — Uses getQADData() generic
  AccountLookup.ts      — Uses getQADData() generic
  SiteLookup.ts         — Uses getQADData() generic
  ItemLookup.ts         — Uses item.ts or getQADData()
  ...
```

---

## iPurchase Legacy Reference

### BeProxy Pattern (OE Side)

All iPurchase BE calls go through `BeCaller.cls` which formats the call and sends it to the PASOE AppServer. Each entity has a proxy class:

| Class | File | Purpose |
|-------|------|---------|
| `BeSupplier.cls` | `com/ISSGroup/iPurchase/BeProxy/BeSupplier.cls` | Vendor master + address |
| `BePO.cls` | (same path) | Purchase orders |
| `BeItem.cls` | (same path) | Item master |
| (others) | (same path) | Accounts, cost centers, sites, etc. |

Each class defines static variables mapping method names to `"procedure.p,entryPoint"` strings, and exposes typed methods that call `makeCall()`.

### Settings That Affect QAD Calls

| Setting | Effect |
|---------|--------|
| `SUPPLIER_SEARCH_MATCHES` | `true` = contains match (`beListSuppliersMatch`), `false`/default = starts-with (`beListSuppliers`) |

### PASOE Broker Config

Connection details stored in `pasoe_brokers` PostgreSQL table (iSolutions database).

| Column | Type | Description |
|--------|------|-------------|
| `oid` | uuid | Primary key |
| `id` | integer | Display ID |
| `name` | citext | Broker name (e.g. "Demo1") |
| `domain` | citext | Domain code (e.g. "DEMO1") — used to match the right broker for a given domain |
| `connect_string` | text | AppServer connection string (e.g. `-URL http://localhost:8080/QAD/apsv -sessionModel Session-free`) |
| `proxy_connect` | text | Alternative/proxy connection |
| `cacheable` | boolean | Whether responses can be cached |
| `created_at` | timestamptz | Standard audit |
| `created_by` | citext | Standard audit |
| `updated_at` | timestamptz | Standard audit |
| `updated_by` | citext | Standard audit |

**Sample data:**
```
name=Demo1, domain=DEMO1, connect_string=https://demo.salesi.net/QAD/web/api
name=Demo2, domain=DEMO2, connect_string=https://demo.salesi.net/QAD/web/api
```

The `connect_string` stores the full REST endpoint URL. The proxy uses it as-is (no path appending).

> **Migration note:** Old format was AppServer style (`-URL http://localhost:8080/QAD/apsv -sessionModel Session-free`). Update to plain HTTPS base URL.

### QAD Credentials

QAD database credentials are stored as system settings:

| Setting | Description |
|---------|-------------|
| `QAD_USERNAME` | QAD database username (e.g. `mfg`) |
| `QAD_PASSWORD` | QAD database password (e.g. `mfg`) |

These are read by the proxy via `getSystemSetting()` and passed in the `context` block of every PASOE REST call.
