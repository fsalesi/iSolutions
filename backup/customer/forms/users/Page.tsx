/**
 * Customer Users page override.
 * Provides its own default export so it can pass customer buttonHandlers to FormPage.
 * This file is NEVER overwritten by re-generate.
 */
import { FormPage } from "@/components/pages/FormPage";
import { buttonHandlers as productHandlers, lookupHandlers as productLookupHandlers } from "@/components/forms/users/Page";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";
import type { LookupHandlers } from "@/components/pages/FormPage";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
}

export const buttonHandlers: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>> = {
  ...productHandlers,
};

export const lookupHandlers: LookupHandlers = {
  ...productLookupHandlers,

  alertLookupSelection: (ctx) => {
    if (ctx.reason !== "select") return;
    const picked = ctx.sourceRecord ? JSON.stringify(ctx.sourceRecord) : "(none)";
    alert(`[users] alertLookupSelection\nfield: ${ctx.sourceField}\nreason: ${ctx.reason}\nrecord: ${picked}`);
  },

  alertLookupReason: (ctx) => {
    alert(`[users] alertLookupReason\nfield: ${ctx.sourceField}\nreason: ${ctx.reason}`);
  },
};

export default function CustomerUsersPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="users"
      apiPath="/api/forms/users"
      buttonHandlers={buttonHandlers}
      lookupHandlers={lookupHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
