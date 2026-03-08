/**
 * AlertDialogService — Global singleton that drives the alert dialog modal.
 *
 * Call from any class that has a `form` reference:
 *   await this.form.alertDialog.error("Something went wrong.");
 *   const ok = await this.form.alertDialog.danger({ title: "Delete", message: "Are you sure?" });
 *   const go = await this.form.alertDialog.warning({ title: "Warning", message: "This may affect other records." });
 *   await this.form.alertDialog.info("Record saved successfully.");
 *
 * The AlertDialogRenderer mounts once in AppShell and listens via the static emitter.
 * All four methods return Promise<boolean>.
 */

export type AlertDialogVariant = "error" | "danger" | "warning" | "info";

export interface AlertDialogOptions {
  variant:        AlertDialogVariant;
  title:          string;
  message:        string;
  confirmLabel?:  string;   // default varies by variant
  cancelLabel?:   string;   // default "Cancel" — only shown for danger/warning
}

type AlertDialogListener = (options: AlertDialogOptions, resolve: (result: boolean) => void) => void;

// --- Singleton event emitter ---
let _listener: AlertDialogListener | null = null;

function emit(options: AlertDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!_listener) {
      // No renderer mounted yet — degrade gracefully
      resolve(window.confirm(`${options.title}\n\n${options.message}`));
      return;
    }
    _listener(options, resolve);
  });
}

/** Register the one renderer. Called by AlertDialogRenderer on mount. */
export function _registerAlertDialogListener(fn: AlertDialogListener) {
  _listener = fn;
}

export function _unregisterAlertDialogListener() {
  _listener = null;
}

// --- Public API (exposed on PageDef as this.form.alertDialog) ---
export const AlertDialogService = {
  /** Red — acknowledgement only. Always resolves true. */
  error(message: string, title = "Error"): Promise<boolean> {
    return emit({ variant: "error", title, message, confirmLabel: "OK" });
  },

  /** Red — destructive confirmation. Cancel = false, Confirm = true. */
  danger(opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }): Promise<boolean> {
    return emit({
      variant:      "danger",
      title:        opts.title,
      message:      opts.message,
      confirmLabel: opts.confirmLabel ?? "Delete",
      cancelLabel:  opts.cancelLabel  ?? "Cancel",
    });
  },

  /** Amber — proceed-or-not confirmation. Cancel = false, Continue = true. */
  warning(opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }): Promise<boolean> {
    return emit({
      variant:      "warning",
      title:        opts.title,
      message:      opts.message,
      confirmLabel: opts.confirmLabel ?? "Continue",
      cancelLabel:  opts.cancelLabel  ?? "Cancel",
    });
  },

  /** Blue — informational. Always resolves true. */
  info(message: string, title = "Information"): Promise<boolean> {
    return emit({ variant: "info", title, message, confirmLabel: "OK" });
  },
};
