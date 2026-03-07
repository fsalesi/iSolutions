/**
 * SettingsPage — Product page component (ISS layer).
 * Wraps the engine FormPage with this form's key and API path.
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

export const buttonHandlers: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>> = {
};

export const lookupHandlers: LookupHandlers = {
};

export default function SettingsPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="settings"
      apiPath="/api/forms/settings"
      buttonHandlers={buttonHandlers}
      lookupHandlers={lookupHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
