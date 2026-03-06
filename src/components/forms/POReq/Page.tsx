/**
 * POReqPage — Product page component (ISS layer).
 * Wraps the engine FormPage with this form's key and API path.
 * ISS developers can add custom tabs, toolbar buttons, or field renderers here.
 */
import { FormPage } from "@/components/pages/FormPage";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
}

export const buttonHandlers: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>> = {

  importReq: async (_ctx) => {
    alert("I am button import in the product version");
  },

  exportReq: async (_ctx) => {
    alert("I am button export in the product version");
  },

};

export default function POReqPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="POReq"
      apiPath="/api/forms/POReq"
      buttonHandlers={buttonHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
