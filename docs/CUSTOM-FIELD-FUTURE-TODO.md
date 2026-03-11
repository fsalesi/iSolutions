# Custom Field Deferred Work

## Delete And Purge Path

Current behavior:
- `Hide` removes the field from the panel only.
- `Remove Custom Field` deletes the custom field definition.
- Definition deletion is blocked when any record contains a non-blank saved value for that custom field.

Deferred enhancement:
- Add a second destructive admin action for dev/build-time cleanup:
  - `Delete Custom Field And Purge Data`
- This action should:
  - delete the `custom_field` definition row from `panel_layout`
  - delete any matching `field` placement rows from `panel_layout`
  - remove that key from `custom_fields` JSONB across all rows in the target table
- This must require a strong confirmation message because it is destructive.

Suggested guardrails:
- admin only
- explicit destructive wording
- ideally limited to dev mode or advanced admin path
- show affected record count before confirmation if practical
