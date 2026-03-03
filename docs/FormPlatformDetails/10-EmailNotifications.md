# 10. Email Notifications

> **PHASE 2** — Builds on top of the Approval Workflow. Email notifications are primarily needed for approval events (submit, approve, reject). Will be implemented alongside Section 10 (Approval Workflow).

> Event-driven email system. Templates with dynamic field substitution. Triggers on form events (save, submit, approve, reject, etc.).

## How It Works

Email notifications are configured per form, triggered by events:

| Event | When it fires |
|---|---|
| on_create | New record saved for the first time |
| on_update | Existing record updated |
| on_submit | Record submitted for approval (Phase 2) |
| on_approve | Record approved (Phase 2) |
| on_reject | Record rejected (Phase 2) |
| on_delete | Record deleted |

## Email Templates

Templates are stored in the database with dynamic field substitution:

```
Subject: New Supplier Created: {{vendor_name}}
Body:
  A new supplier has been created by {{created_by}}.
  
  Vendor: {{vendor_name}}
  Tax ID: {{tax_id}}
  Domain: {{domain}}
  
  View: {{record_link}}
```

Fields enclosed in `{{field_name}}` are replaced at send time with values from the record.

## Recipients

Recipients can be:
- **Static** — specific email addresses or user IDs
- **Field-based** — value of a field on the record (e.g., `{{buyer}}` resolves to user, then to email)
- **Role-based** — all members of a group (e.g., "Purchasing Managers")
- **Dynamic** — custom logic via route override (e.g., "all approvers in the chain")

## Configuration

In the Entity Designer or a separate Email Configuration screen:
- Which events trigger emails
- Which template to use per event
- Who receives each notification
- Per-domain overrides (different templates or recipients per domain)

## Platform Table

```
platform_email_config:
  oid
  domain                ← * for all domains, or specific
  entity_type           ← which form
  event                 ← on_create, on_submit, etc.
  template_subject      ← subject with {{field}} placeholders
  template_body         ← body with {{field}} placeholders
  recipients            ← JSON: static addresses, field refs, group refs
  is_active             ← enable/disable without deleting
  created_at, created_by, updated_at, updated_by
```

## Sending

Emails are queued, not sent synchronously. A background job processes the queue. Failed emails are retried with backoff. Email history is logged for audit.

TBD:
- Email queue table structure
- Retry logic and failure handling
- HTML vs plain text templates
- Attachment support (e.g., attach a PDF of the record)
