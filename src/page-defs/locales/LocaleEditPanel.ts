import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef } from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef } from "@/platform/core/FieldDef";

export class LocaleEditPanel extends EditPanel {
  constructor(form?: any) {
    super({ useAudit: true }, form);

    this.tabs = [
      new TabDef({ key: "details", label: "Details", children: [

        new SectionDef({ key: "main", columns: 2, children: [
          new FieldDef({ key: "code",        label: "Code",        keyField: true, required: true }),
          new FieldDef({ key: "description", label: "Description", required: true }),
        ]}),

        new SectionDef({ key: "format", label: "Format", columns: 3, children: [
          new FieldDef({ key: "date_format",    label: "Date Format",         required: true,
            renderer: "select",
            options: [
              { value: "mdy", label: "MM/DD/YYYY  (US)" },
              { value: "dmy", label: "DD/MM/YYYY  (UK/EU)" },
              { value: "ymd", label: "YYYY/MM/DD  (ISO)" },
            ],
          }),
          new FieldDef({ key: "decimal_char",   label: "Decimal Character",   required: true,
            renderer: "select",
            options: [
              { value: ".", label: ". (period)" },
              { value: ",", label: ", (comma)"  },
            ],
          }),
          new FieldDef({ key: "separator_char", label: "Thousands Separator",
            renderer: "select",
            options: [
              { value: ",", label: ", (comma)"  },
              { value: ".", label: ". (period)" },
              { value: " ", label: "  (space)"  },
              { value: "",  label: "(none)"     },
            ],
          }),
        ]}),

        new SectionDef({ key: "misc", label: "Miscellaneous", columns: 2, children: [
          new FieldDef({ key: "is_default", label: "Default Locale", renderer: "checkbox" }),
          new FieldDef({ key: "flag_svg",   label: "Flag SVG",    renderer: "svg" }),
        ]}),

      ]}),
    ];
  }
}
