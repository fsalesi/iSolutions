# DatePicker Component — Technical Specification

> Shared date/time picker component for iSolutions.
> Used everywhere a date or datetime field appears: detail forms, report filters, advanced search, grid inline editing.

---

## Component API

```tsx
import { DatePicker } from "@/components/ui/DatePicker";

// Date only
<DatePicker value={row.expire_date} onChange={v => onChange("expire_date", v)} />

// DateTime
<DatePicker value={row.created_at} onChange={v => onChange("created_at", v)} mode="datetime" />

// Date range
<DatePicker
  mode="range"
  value={fromDate}
  valueTo={toDate}
  onChange={setFromDate}
  onChangeTo={setToDate}
/>

// With constraints
<DatePicker
  value={row.end_date}
  onChange={v => onChange("end_date", v)}
  min={row.start_date}
  max="2026-12-31"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| null` | — | ISO date string (from date in range mode) |
| `onChange` | `(iso: string \| null) => void` | — | Called with ISO string or null when cleared |
| `mode` | `"date" \| "datetime" \| "range"` | `"date"` | What to pick |
| `valueTo` | `string \| null` | — | Range mode: end date |
| `onChangeTo` | `(iso: string \| null) => void` | — | Range mode: end date change handler |
| `min` | `string \| null` | — | Earliest selectable date (ISO string) |
| `max` | `string \| null` | — | Latest selectable date (ISO string) |
| `disabled` | `boolean` | `false` | Disable input |
| `readOnly` | `boolean` | `false` | Read-only display |
| `required` | `boolean` | `false` | Visual required indicator (red border if empty) |
| `placeholder` | `string` | — | Input placeholder (auto-generated from locale format if omitted) |
| `timeStep` | `number` | `15` | Time picker increment in minutes (5, 10, 15, 30, 60) |
| `presets` | `Preset[] \| boolean` | `false` | Range mode: show quick-select presets. `true` = default set |
| `error` | `string` | — | Error message to display below input |
| `clearable` | `boolean` | `true` | Show clear (×) button |

### Preset Type

```typescript
type Preset = {
  label: string;        // Display label (translated)
  from: string | null;  // ISO date or null
  to: string | null;    // ISO date or null
};
```

Default presets when `presets={true}`:
- Today
- Yesterday  
- This Week (Mon–Sun)
- Last 7 Days
- This Month
- Last 30 Days
- This Quarter
- Year to Date

---

## Data Contract

### Storage
- All dates stored as `timestamptz` in PostgreSQL (even date-only fields)
- Date-only fields store as midnight UTC: `2026-03-01T00:00:00.000Z`
- Component accepts and returns **ISO 8601 strings**
- `null` represents an empty/cleared date

### Timezone
- Dates display in the **user's browser timezone**
- Stored in UTC in the database
- The component does not do timezone conversion — it works with ISO strings and lets the browser's `Date` handle display

---

## Locale-Aware Display

The component reads the user's locale from `TranslationContext` and formats accordingly.

### Date Format Patterns

| Locale | Date | DateTime |
|--------|------|----------|
| `en-us` | `MM/DD/YYYY` | `MM/DD/YYYY hh:mm A` |
| `en-uk` | `DD/MM/YYYY` | `DD/MM/YYYY HH:mm` |
| `fr` | `DD/MM/YYYY` | `DD/MM/YYYY HH:mm` |
| `de` | `DD.MM.YYYY` | `DD.MM.YYYY HH:mm` |
| `ja` | `YYYY/MM/DD` | `YYYY/MM/DD HH:mm` |
| `ko` | `YYYY.MM.DD` | `YYYY.MM.DD HH:mm` |
| `zh-cn` | `YYYY-MM-DD` | `YYYY-MM-DD HH:mm` |

Format is derived from the `date_format` column in the `locales` table. The component uses `Intl.DateTimeFormat` with the locale code for rendering, so most formats come free.

### Time Display
- 12-hour with AM/PM: `en-us`
- 24-hour: everything else
- Derived from locale automatically via `Intl.DateTimeFormat`

---

## Interaction Design

### Input Field
- Text input with calendar icon button on the right
- Typing a date directly is supported with smart parsing:
  - `3/15` → March 15 of current year
  - `3/15/26` → March 15, 2026
  - `15.03.2026` → March 15, 2026 (European)
  - Parsing respects locale format order (MDY vs DMY vs YMD)
- On blur: validate and format to locale pattern
- On Enter: confirm and close popup
- On Escape: revert and close popup
- Tab moves between from/to fields in range mode, and between date/time portions in datetime mode

### Calendar Popup
- Opens on input focus or calendar icon click
- Closes on outside click, Escape, or selection
- Month grid with day cells
- Header: `< March 2026 >` with month/year navigation
- Click month/year text to switch to month picker, then year picker (drill-up)
- **Today** button at bottom
- Arrow keys navigate days, Page Up/Down navigate months
- Disabled dates (outside min/max) shown grayed out, not clickable

### Range Mode
- Two input fields: From | To
- Calendar shows range highlight (colored band between from and to)
- Selecting from-date:
  - If to-date is empty → to-date stays empty
  - If from-date moves past to-date → to-date auto-advances to from-date
- Selecting to-date:
  - Cannot select before from-date (days are disabled)
- Presets panel (if enabled): sidebar or row of quick-select buttons

### DateTime Mode
- Date input + time input side by side
- Time input: dropdown/spinner showing times at `timeStep` intervals
- Or direct keyboard entry: `2:30 PM` or `14:30`
- When date is selected and time is empty: default to `00:00` (midnight)

### Clear
- × button clears the value to `null`
- In range mode: clears both from and to

---

## Validation

### Built-in
- `min` / `max` enforcement: dates outside range cannot be selected in calendar, typed dates are rejected on blur with error styling
- Range mode: to-date ≥ from-date enforced automatically
- `required`: red border + error state when empty and form has been touched

### Custom
- `error` prop: parent can pass validation message (e.g. "Must be a business day")
- Visual: red border on input, error text below in `var(--danger-text)`

---

## Visual Design

### Sizing
- Input height: 34px (matches all other form inputs)
- Calendar popup: ~280px wide, absolute positioned below input
- Range mode: two inputs side by side with `→` separator

### Theming
- Uses existing CSS custom properties:
  - `--input-bg`, `--input-border`, `--border-focus` for input
  - `--bg-surface`, `--border` for popup
  - `--accent`, `--accent-light` for selected date and range highlight
  - `--text-muted` for disabled dates
  - `--danger-text`, `--danger-border` for errors
  - `--bg-hover` for hover states
- Dark mode works automatically through theme tokens

### Layout

```
┌─────────────────────────┐
│ 03/01/2026        📅  × │  ← Single date input
└─────────────────────────┘

┌─────────────────────────┐
│ 03/01/2026 2:30 PM 📅 × │  ← DateTime input
└─────────────────────────┘

┌────────────┐   ┌────────────┐
│ 03/01/2026 │ → │ 03/31/2026 │  ← Range inputs
└────────────┘   └────────────┘

┌──────────────────────────────┐
│  <    March 2026    >        │  ← Calendar popup
│ Mo Tu We Th Fr Sa Su         │
│                 1  2         │
│  3  4  5  6  7  8  9        │
│ 10 11 12 13 14 15 16        │
│ 17 18 19 20 21 22 23        │
│ 24 25 26 27 28 29 30        │
│ 31                           │
│         [ Today ]            │
└──────────────────────────────┘
```

---

## Integration Points

### Detail Forms (CrudPage)
```tsx
<Field label="Expiration Date">
  <DatePicker value={row.expire_date} onChange={v => onChange("expire_date", v)} />
</Field>
```

### Advanced Search (DataGrid filters)
- `datetime` column type → DatePicker replaces text input in AdvancedSearch condition rows
- Range operators (`between`) use range mode
- Single operators (`eq`, `gt`, `lt`, `ge`, `le`) use single date mode

### Report Parameters
```tsx
<DatePicker
  mode="range"
  value={params.fromDate}
  valueTo={params.toDate}
  onChange={v => setParams(p => ({ ...p, fromDate: v }))}
  onChangeTo={v => setParams(p => ({ ...p, toDate: v }))}
  presets
/>
```

### Grid Inline Display
- For read-only grid cells, dates are formatted using the same locale logic
- Export a `formatDate(iso, locale, mode)` utility from the DatePicker module for use in grid cell renderers

---

## Exported Utilities

```typescript
// Format an ISO date string for display
export function formatDate(iso: string | null, locale: string, mode?: "date" | "datetime"): string;

// Parse a locale-formatted string back to ISO
export function parseDate(input: string, locale: string): string | null;

// Default presets (translated)
export function getDefaultPresets(t: TFunction): Preset[];
```

---

## File Structure

```
src/components/ui/
├── DatePicker.tsx          # Main component (input + popup orchestration)
├── DatePickerCalendar.tsx  # Calendar grid sub-component
├── DatePickerTime.tsx      # Time selector sub-component  
├── DatePickerPresets.tsx   # Range presets panel
└── date-utils.ts           # formatDate, parseDate, locale helpers
```

---

## Implementation Phases

### Phase 1: Core Single Date
- Date-only input with calendar popup
- Locale-aware formatting via Intl
- Min/max constraints
- Keyboard entry with smart parsing
- Clear button
- Theme integration

### Phase 2: DateTime
- Time input alongside date
- Time step intervals
- 12h/24h based on locale

### Phase 3: Range Mode
- From/to dual inputs
- Auto-advance to-date logic
- Range highlighting in calendar
- Min/max across both fields

### Phase 4: Presets & Integration
- Quick-select presets for range mode
- Wire into AdvancedSearch for datetime columns
- Grid cell formatter utility
- Report parameter usage

---

## Dependencies

- **Zero external dependencies** — no date-fns, no moment, no dayjs
- Uses native `Date`, `Intl.DateTimeFormat`, and `Intl.DateTimeFormat.formatToParts()`
- All rendering is custom (no browser `<input type="date">`)

---

## Non-Goals

- Date-only database columns (everything is timestamptz)
- Timezone selector UI (we use browser timezone, store UTC)
- Recurring date patterns
- Calendar week view / agenda view
