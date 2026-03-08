# 7. Menu Integration

> Auto-generated menu entries for forms. First generate creates the entry. Menu system supports categories, ordering, and security.

## Auto-Generation

When a form is first generated, a menu entry is created automatically:
- Menu label = form name (from Entity Designer)
- Points to `customer/forms/<form>/page.tsx` (always the customer version — never the src version)
- Menu category selected by the admin during Entity Designer setup (dropdown of existing categories)

## Menu Structure

The menu system supports:
- **Categories** — grouping of menu items (e.g., Purchasing, Finance, HR)
- **Ordering** — sort order within a category
- **Icons** — optional icon per menu item
- **Security** — which users/groups can see each menu item

## Admin Configuration

After generation, an admin can:
- Move the menu entry to a different category
- Change the label
- Change the sort order
- Assign an icon
- Set security (restrict to specific users or groups)

This is done through the existing menu maintenance screen, not the Entity Designer.

## Menu Table

The existing menu infrastructure handles this — no new tables needed for menu entries. The Entity Designer simply inserts a row into the existing menu table on first generate.

## Security

Menu visibility is controlled by user/group access lists. If a user doesn't have access to the menu entry, they don't see the form. This is independent of domain — a user might have domain access but not menu access to a specific form, or vice versa.

TBD:
- How menu security interacts with form-level permissions
- Whether the Entity Designer can set initial security at generation time
- Auto-remove menu entry if a form is deleted
