/**
 * Customer Users page override.
 * Provides its own default export so it can pass customer buttonHandlers to FormPage.
 * This file is NEVER overwritten by re-generate.
 */
import { FormPage } from "@/components/pages/FormPage";
import { buttonHandlers as productHandlers } from "@/components/forms/users/Page";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
}

export const buttonHandlers: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>> = {
  ...productHandlers,
};

export default function CustomerUsersPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: Props) {
  return (
    <FormPage
      formKey="users"
      apiPath="/api/forms/users"
      buttonHandlers={buttonHandlers}
      activeNav={activeNav}
      onNavigate={onNavigate}
      selectRecordOid={selectRecordOid}
      selectSeq={selectSeq}
    />
  );
}
