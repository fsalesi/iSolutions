# Customer Overrides

This folder contains customer-specific overrides for generated forms.
Files here are **never touched by product upgrades or the generator** after initial creation.

## Structure

```
customer/
├── forms/
│   └── <form_key>/
│       ├── page.tsx       ← UI: extends src/app/forms/<form>/page.tsx
│       └── route.ts       ← API: extends src/app/forms/<form>/route.ts
└── README.md
```

## Rules

- Menu entries and API routes always resolve through the customer layer
- Customer files are generated once as empty shims — all customization goes here
- Use `super` to call product behavior, skip it to replace
- Product upgrades update `src/` files only — this folder is untouched
