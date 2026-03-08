/**
 * Customer POReq page override.
 * Provides its own default export so it can pass the customer buttonHandlers to FormPage.
 * This file is NEVER overwritten by re-generate.
 */
import { FormPage } from "@/components/pages/FormPage";
import { buttonHandlers as productHandlers, lookupHandlers as productLookupHandlers } from "@/components/forms/POReq/Page";
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

  // New handler — customer only
  downloadReq: async (_ctx) => {
    alert("I am button download in the customer version");
  },

  // Override importReq — runs super first (2 alerts expected)
  importReq: async (ctx) => {
    await productHandlers.importReq(ctx); // super
    alert("I am button import in the customer version");
  },

  // Override exportReq — no super (1 alert only)
  exportReq: async (_ctx) => {
    alert("I am button export in the customer version");
  },
};

export const lookupHandlers: LookupHandlers = {
  ...productLookupHandlers,
};

export default function CustomerPOReqPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="POReq"
      apiPath="/api/forms/POReq"
      buttonHandlers={buttonHandlers}
      lookupHandlers={lookupHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
