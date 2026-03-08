/**
 * EntityEditor2Page - Product page component (ISS layer).
 */
import { FormPage } from "@/components/pages/FormPage";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";
import type { LookupHandlers } from "@/components/pages/FormPage";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
}

export const buttonHandlers: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>> = {};

export const lookupHandlers: LookupHandlers = {};

export default function EntityEditor2Page({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
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
