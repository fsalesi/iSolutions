# Customer Overrides

This folder contains customer-specific overrides for iSolutions v2.
Files here are **never touched by product upgrades** after initial creation.

## Structure

```
customer/
├── api/
│   └── <entity>/
│       └── route.ts    ← API: extends src/app/api/<entity>/route.ts
└── README.md
```

## Rules

- Customer route files extend the product `CrudRoute` class
- Use `super` to call product behavior, skip it to replace entirely
- Product upgrades update `src/` only — this folder is never touched
- Customer page overrides (UI layer) will live here too once the renderer exists
