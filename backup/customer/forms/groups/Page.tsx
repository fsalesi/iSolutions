/**
 * Customer Groups page override.
 * This file is NEVER overwritten by re-generate.
 */
import { FormPage } from "@/components/pages/FormPage";
import { buttonHandlers as productHandlers, lookupHandlers as productLookupHandlers } from "@/components/forms/groups/Page";
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
};

export default function CustomerGroupsPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="groups"
      apiPath="/api/forms/groups"
      buttonHandlers={buttonHandlers}
      lookupHandlers={lookupHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
