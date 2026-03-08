import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef } from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef } from "@/platform/core/FieldDef";

/**
 * SsoEditPanel — Edit panel for SSO Configuration.
 *
 * Tab: Details
 *   Section: Identity
 *     provider_id  (readonly — key field)
 *     label        (Provider Name)
 *     is_active
 *     show_on_login
 *
 * Tab: OAuth
 *   Section: Credentials
 *     client_id
 *     client_secret  (password)
 *   Section: Endpoints
 *     authorization_url
 *     token_url
 *     logoff_url
 *     scope
 */
export class SsoEditPanel extends EditPanel {
  constructor(form?: any) {
    super({
      useNotes: true,
      useAudit: true,
      usePrint: false,
    }, form);

    this.tabs = [

      new TabDef({
        key:   "details",
        label: "Details",
        children: [
          new SectionDef({
            key:      "identity",
            label:    "Identity",
            columns:  2,
            children: [
              new FieldDef({ key: "provider_id", label: "Provider ID",    keyField: true }),
              new FieldDef({ key: "label",       label: "Provider Name",  required: true }),
              new FieldDef({ key: "is_active",    label: "Active",         renderer: "checkbox" }),
              new FieldDef({ key: "show_on_login", label: "Show on Login", renderer: "checkbox" }),
            ],
          }),
        ],
      }),

      new TabDef({
        key:   "oauth",
        label: "OAuth",
        children: [
          new SectionDef({
            key:      "credentials",
            label:    "Credentials",
            columns:  1,
            children: [
              new FieldDef({ key: "client_id",     label: "Client ID",     required: true }),
              new FieldDef({ key: "client_secret", label: "Client Secret", required: true, renderer: "password" }),
            ],
          }),
          new SectionDef({
            key:      "endpoints",
            label:    "Endpoints",
            columns:  1,
            children: [
              new FieldDef({ key: "authorization_url", label: "Authorization URL", required: true }),
              new FieldDef({ key: "token_url",         label: "Token URL",         required: true }),
              new FieldDef({ key: "logoff_url",        label: "Logoff URL" }),
              new FieldDef({ key: "scope",             label: "Scope" }),
            ],
          }),
        ],
      }),

    ];
  }
}
