# iSolutions I18N Direction Note

## Decision

iSolutions should use two distinct translation models:

1. **Metadata text translation** for labels and other structural UI text.
2. **Message catalog translation** for runtime phrases such as errors, warnings, confirmations, and informational text.

This is an intentional split. Labels are part of form/component metadata. Messages are executable user-facing phrases that benefit from stable identifiers.

---

## 1. Metadata Text Translation

Use metadata/context-based translation for:
- field labels
- tab labels
- section labels
- button labels
- placeholders
- help text
- other structural UI text

### Resolution Model

Metadata text should be resolved by context, not by global string key.

Recommended identity shape:
- `form_key`
- `component`
- `element_type`
- `element_key`
- `property`
- `locale`

Examples:
- requisition / panel:edit / field / buyer / label
- requisition / panel:edit / section / header / label
- requisition / toolbar / button / save / label

### Why

This fits dynamic designer-created UI much better than file-based translation keys.
It also avoids inventing synthetic key namespaces for runtime-added fields, tabs, and sections.

### Designer Compatibility

Panel designer persistence should continue to own structure and state:
- tab/section/field placement
- hidden/readOnly/etc.

Localized labels for those elements should be resolved through metadata translation, not through file-based message keys.

---

## 2. Message Catalog Translation

Use a `message_nbr` model for runtime phrases such as:
- errors
- warnings
- confirmations
- informational messages
- validation messages
- toast/status text
- backend user-facing messages

Examples:
- "Save failed"
- "Field is required"
- "Do you want to delete this record?"
- "Only empty tabs can be removed right now"

### Resolution Model

- code references `message_nbr`
- translation table stores localized text by `message_nbr + locale`
- code also keeps a fallback/default phrase

### Why

`message_nbr` gives:
- stable identifiers
- easier tracing from UI/logs to code
- cleaner backend/frontend coordination
- no dependence on English text as a key

---

## 3. What Not To Do

Do not force designer-created labels into the file-based `tx(key, fallback)` product-key model.
That model is appropriate for product-owned source strings, but it does not fit dynamic runtime UI well.

Do not force labels/titles/placeholders into the `message_nbr` catalog either.
Those are metadata text, not runtime phrases.

---

## 4. Practical Direction

Short term:
- current designer label overrides can remain literal until the metadata translation layer is implemented

Medium term:
- add metadata translation storage/resolution for form/component/element/property text
- keep `panel_layout` focused on structure/state, not full translation payloads

Long term:
- use metadata translation for labels and structural UI text everywhere practical
- use `message_nbr` for all runtime user-facing phrases across frontend and backend

---

## 5. Summary

The intended i18n split for iSolutions is:

- **Metadata text**: context-based translation
- **Runtime phrases/messages**: `message_nbr` translation

This keeps the system compatible with dynamic designer-driven UI while still providing strong traceability for real messages.
