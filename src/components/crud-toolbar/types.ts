/**
 * Context object passed to every button handler at runtime.
 * Provides access to the current record and common actions.
 */
export type ButtonHandlerContext = {
  /** Current record OID */
  oid: string;
  /** Full current row data */
  row: Record<string, any>;
  /** Form key (e.g. "POReq") */
  formKey: string;
  /** Reload the form/grid */
  reload: () => void;
  /** Show a toast notification */
  notify: (message: string, type?: "success" | "error" | "info") => void;
  /** Pre-authenticated fetch */
  fetch: (url: string, opts?: RequestInit) => Promise<Response>;
};
