/**
 * Customer EntityEditor2 page override.
 */
import { FormPage } from "@/components/pages/FormPage";
import { buttonHandlers as productHandlers, lookupHandlers as productLookupHandlers } from "@/components/forms/entity_editor2/Page";
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

export default function CustomerEntityEditor2Page({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="entity_editor2"
      apiPath="/api/forms/entity_editor2"
      buttonHandlers={buttonHandlers}
      lookupHandlers={lookupHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
