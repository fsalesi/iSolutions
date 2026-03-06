/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";
/**
 * FormBody barrel.
 * Shared logic lives in:
 *   - FormBody.controller.ts
 *   - FormBody.canvas.tsx
 *   - FormBody.panels.tsx
 */

export * from "./FormBody.controller";
export * from "./FormBody.canvas";
export * from "./FormBody.panels";
