/**
 * POReqPage — Product page component (ISS layer).
 * Wraps the engine FormPage with this form's key and API path.
 * ISS developers can add custom tabs, toolbar buttons, or field renderers here.
 */
import { FormPage } from "@/components/pages/FormPage";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
}

export default function POReqPage({ activeNav, onNavigate }: Props) {
  return (
    <FormPage
      formKey="POReq"
      apiPath="/api/forms/POReq"
      activeNav={activeNav}
      onNavigate={onNavigate}
    />
  );
}
