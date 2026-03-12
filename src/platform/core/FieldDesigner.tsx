import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { Checkbox, Input, Select } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { PanelDef } from "./PanelDef";
import type { FieldDef } from "./FieldDef";
import { DrawerService } from "./DrawerService";
import {
  LOOKUP_DATASOURCE_OPTIONS,
  LOOKUP_PRESET_OPTIONS,
  LOOKUP_SOURCE_OPTIONS,
  buildLookupConfig,
  extractLookupDefinition,
  serializeLookupDefinition,
  type LookupDataSourceName,
  type LookupFieldMapEntry,
  type LookupPresetName,
  type LookupSourceType,
} from "./LookupDefinition";
import type { QadConfigMetadata } from "@/lib/qad/QadConfigService";
import {
  getCustomFieldDefinitionSettings,
  getFieldLayoutSettings,
  getFieldParentKey,
  isCustomField,
  isDesignerAddedField,
  moveFieldLayout,
  removeCustomFieldDefinition,
  removeFieldLayout,
  saveCustomFieldDefinition,
  saveFieldLayoutSettings,
} from "./PanelLayoutRuntime";

export class FieldDesigner {
  title = "Field Properties";
  drawerKey = "field-designer";

  constructor(public panel: PanelDef, public field: FieldDef) {}

  show(): ReactNode {
    return <FieldDesignerPanel designer={this} />;
  }
}

function parseFieldMap(text: string): LookupFieldMapEntry[] | undefined {
  const rows = text
    .split(/\r?\n|,/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.includes("|") ? line.split("|") : line.split("->");
      if (parts.length < 2) return null;
      const source = String(parts[0] ?? "").trim();
      const target = String(parts[1] ?? "").trim();
      return source && target ? { source, target } : null;
    })
    .filter(Boolean) as LookupFieldMapEntry[];
  return rows.length ? rows : undefined;
}

function stringifyFieldMap(values?: LookupFieldMapEntry[]): string {
  return Array.isArray(values) && values.length ? values.map(v => `${v.source} -> ${v.target}`).join(", ") : "";
}

function getLookupHandlerOptions(form: any): Array<{ key: string; label: string; description?: string }> {
  const options = form?.lookupHandlerOptions;
  return Array.isArray(options) ? options : [];
}

function hasOwn<T extends object, K extends PropertyKey>(obj: T, key: K): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function uniqueKeys(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map(value => String(value ?? "").trim()).filter(Boolean)));
}

function parseDelimitedList(value: string): string[] {
  return uniqueKeys(value.split(/[\r\n,]+/));
}

function getLookupColumnCandidates(config: ReturnType<typeof buildLookupConfig>): string[] {
  if (!config) return [];
  return uniqueKeys([
    config.valueField,
    config.displayField,
    ...(config.searchColumns ?? []),
    ...((config.dropdownColumns ?? []).map(col => typeof col === "string" ? col : col.key)),
    ...((config.gridColumns ?? []).map(col => String(col?.key ?? "").trim())),
  ]);
}

function ToggleDefault({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <Checkbox checked={checked} onChange={onChange} label="Use Default" />;
}

function MultiSelectChecks({
  options,
  selected,
  onChange,
  disabled = false,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const current = new Set(selected);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, opacity: disabled ? 0.6 : 1 }}>
      {options.map(option => (
        <Checkbox
          key={option}
          checked={current.has(option)}
          onChange={checked => {
            if (disabled) return;
            const next = checked ? [...selected, option] : selected.filter(item => item !== option);
            onChange(Array.from(new Set(next)));
          }}
          label={option}
        />
      ))}
    </div>
  );
}

function FieldMapEditor({
  mappings,
  sourceOptions,
  targetOptions,
  onChange,
}: {
  mappings: LookupFieldMapEntry[];
  sourceOptions: string[];
  targetOptions: string[];
  onChange: (next: LookupFieldMapEntry[]) => void;
}) {
  const sourceSelectOptions = [{ value: "", label: "—" }, ...sourceOptions.map(key => ({ value: key, label: key }))];
  const targetSelectOptions = [{ value: "", label: "—" }, ...targetOptions.map(key => ({ value: key, label: key }))];

  const updateRow = (index: number, patch: Partial<LookupFieldMapEntry>) => {
    const next = mappings.map((mapping, i) => i === index ? { ...mapping, ...patch } : mapping);
    onChange(next.filter(mapping => mapping.source || mapping.target));
  };

  const removeRow = (index: number) => onChange(mappings.filter((_, i) => i !== index));
  const addRow = () => onChange([...mappings, { source: sourceOptions[0] ?? "", target: targetOptions[0] ?? "" }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {mappings.map((mapping, index) => (
        <div key={`${index}-${mapping.source}-${mapping.target}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
          <Select value={mapping.source} onChange={value => updateRow(index, { source: String(value) })} options={sourceSelectOptions} />
          <Select value={mapping.target} onChange={value => updateRow(index, { target: String(value) })} options={targetSelectOptions} />
          <button type="button" onClick={() => removeRow(index)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: "pointer" }}>Remove</button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button type="button" onClick={addRow} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: "pointer" }}>Add Mapping</button>
      </div>
    </div>
  );
}

function FieldDesignerPanel({ designer }: { designer: FieldDesigner }) {
  const panel = designer.panel;
  const field = designer.field;
  const existing = useMemo(() => getFieldLayoutSettings(panel, field), [panel, field]);
  const storedLookup = existing.lookupDefinition ?? {};

  const customDef = useMemo(() => getCustomFieldDefinitionSettings(panel, field.key), [panel, field]);
  const isCustom = useMemo(() => isCustomField(panel, field.key), [panel, field]);
  const existingLookup = useMemo(
    () => existing.lookupDefinition ?? field.lookupDefinition ?? extractLookupDefinition(field.lookupConfig),
    [existing.lookupDefinition, field.lookupDefinition, field.lookupConfig],
  );
  const [lookupSourceColumns, setLookupSourceColumns] = useState<string[]>([]);
  const lookupHandlerOptions = useMemo(() => getLookupHandlerOptions(panel.form), [panel.form]);
  const panelFieldKeys = useMemo(() => panel.fields.map(f => f.key).filter(key => key !== field.key), [panel, field]);
  const { domain: sessionDomain } = useSession();

  const [label, setLabel] = useState(existing.label ?? field.getLabel());
  const [hidden, setHidden] = useState(existing.hidden ?? field.hidden);
  const [readOnly, setReadOnly] = useState(existing.readOnly ?? !!field.readOnly);
  const [required, setRequired] = useState(existing.required ?? !!field.required);
  const [renderer, setRenderer] = useState(existing.renderer ?? field.renderer ?? "text");
  const [sectionKey, setSectionKey] = useState(getFieldParentKey(panel, field.key));
  const [placeholder, setPlaceholder] = useState(existing.placeholder ?? field.placeholder ?? existingLookup?.placeholder ?? "");
  const [maxLength, setMaxLength] = useState(existing.maxLength !== undefined && existing.maxLength !== null ? String(existing.maxLength) : (field.maxLength !== undefined && field.maxLength !== null ? String(field.maxLength) : ""));
  const [scale, setScale] = useState(existing.scale !== undefined && existing.scale !== null ? String(existing.scale) : (field.scale !== undefined && field.scale !== null ? String(field.scale) : ""));
  const [customDataType, setCustomDataType] = useState(customDef?.dataType ?? "text");

  const inferredLookupSourceType: LookupSourceType = existingLookup?.sourceType
    ?? (existingLookup?.dataSourceName ? "datasource" : existingLookup?.apiPath ? "api" : existingLookup?.qadDsName ? "qad_getdata" : "preset");
  const [lookupSourceType, setLookupSourceType] = useState<LookupSourceType>(inferredLookupSourceType);
  const [lookupDataSourceName, setLookupDataSourceName] = useState<LookupDataSourceName>(existingLookup?.dataSourceName ?? "users");
  const [lookupPresetName, setLookupPresetName] = useState<LookupPresetName>(existingLookup?.presetName ?? (field.lookupConfig ? "current" : "custom"));

  const [useDefaultApiPath, setUseDefaultApiPath] = useState(!hasOwn(storedLookup, "apiPath"));
  const [useDefaultValueField, setUseDefaultValueField] = useState(!hasOwn(storedLookup, "valueField"));
  const [useDefaultDisplayField, setUseDefaultDisplayField] = useState(!hasOwn(storedLookup, "displayField"));
  const [useDefaultDisplayTemplate, setUseDefaultDisplayTemplate] = useState(!hasOwn(storedLookup, "displayTemplate"));
  const [useDefaultPlaceholder, setUseDefaultPlaceholder] = useState(!hasOwn(storedLookup, "placeholder"));
  const [useDefaultSearchColumns, setUseDefaultSearchColumns] = useState(!hasOwn(storedLookup, "searchColumns"));
  const [useDefaultDropdownColumns, setUseDefaultDropdownColumns] = useState(!hasOwn(storedLookup, "dropdownColumns"));
  const [useDefaultGridColumns, setUseDefaultGridColumns] = useState(!hasOwn(storedLookup, "gridColumns"));
  const [useDefaultBrowsable, setUseDefaultBrowsable] = useState(!hasOwn(storedLookup, "browsable"));
  const [useDefaultBrowseTitle, setUseDefaultBrowseTitle] = useState(!hasOwn(storedLookup, "browseTitle"));
  const [useDefaultMultiple, setUseDefaultMultiple] = useState(!hasOwn(storedLookup, "multiple"));
  const [useDefaultChecklist, setUseDefaultChecklist] = useState(!hasOwn(storedLookup, "checklist"));
  const [useDefaultChecklistHeight, setUseDefaultChecklistHeight] = useState(!hasOwn(storedLookup, "checklistHeight"));
  const [useDefaultChecklistPageSize, setUseDefaultChecklistPageSize] = useState(!hasOwn(storedLookup, "checklistPageSize"));
  const [useDefaultPreload, setUseDefaultPreload] = useState(!hasOwn(storedLookup, "preload"));
  const [useDefaultLookupReadOnly, setUseDefaultLookupReadOnly] = useState(!hasOwn(storedLookup, "readOnly"));
  const [useDefaultMinChars, setUseDefaultMinChars] = useState(!hasOwn(storedLookup, "minChars"));
  const [useDefaultDropdownLimit, setUseDefaultDropdownLimit] = useState(!hasOwn(storedLookup, "dropdownLimit"));
  const [useDefaultAllOption, setUseDefaultAllOption] = useState(!hasOwn(storedLookup, "allOptionValue") && !hasOwn(storedLookup, "allOptionLabel"));
  const [useDefaultFieldMap, setUseDefaultFieldMap] = useState(!hasOwn(storedLookup, "fieldMap"));
  const [useDefaultHandlerName, setUseDefaultHandlerName] = useState(!hasOwn(storedLookup, "handlerName"));
  const [useDefaultHydrateNonTransient, setUseDefaultHydrateNonTransient] = useState(!hasOwn(storedLookup, "hydrateNonTransient"));

  const [lookupApiPath, setLookupApiPath] = useState(existingLookup?.apiPath ?? "");
  const [lookupQadDsName, setLookupQadDsName] = useState((existingLookup as any)?.qadDsName ?? "");
  const [lookupQadSearchWhere, setLookupQadSearchWhere] = useState((existingLookup as any)?.qadSearchWhere ?? "");
  const [lookupQadUniqueWhere, setLookupQadUniqueWhere] = useState((existingLookup as any)?.qadUniqueWhere ?? "");
  const [lookupQadFieldSet, setLookupQadFieldSet] = useState((existingLookup as any)?.qadFieldSet ?? "");
  const [qadConfigMeta, setQadConfigMeta] = useState<QadConfigMetadata | null>(null);
  const [lookupValueField, setLookupValueField] = useState(existingLookup?.valueField ?? "");
  const [lookupDisplayField, setLookupDisplayField] = useState(existingLookup?.displayField ?? "");
  const [lookupDisplayTemplate, setLookupDisplayTemplate] = useState(existingLookup?.displayTemplate ?? "");
  const [lookupSearchColumns, setLookupSearchColumns] = useState(existingLookup?.searchColumns ?? []);
  const [lookupSearchColumnsText, setLookupSearchColumnsText] = useState((existingLookup?.searchColumns ?? []).join(", "));
  const [lookupDropdownColumns, setLookupDropdownColumns] = useState(existingLookup?.dropdownColumns ?? []);
  const [lookupDropdownColumnsText, setLookupDropdownColumnsText] = useState((existingLookup?.dropdownColumns ?? []).join(", "));
  const [lookupGridColumns, setLookupGridColumns] = useState(existingLookup?.gridColumns ?? []);
  const [lookupGridColumnsText, setLookupGridColumnsText] = useState((existingLookup?.gridColumns ?? []).join(", "));
  const [lookupBrowsable, setLookupBrowsable] = useState(existingLookup?.browsable ?? true);
  const [lookupBrowseTitle, setLookupBrowseTitle] = useState(existingLookup?.browseTitle ?? "");
  const [lookupMultiple, setLookupMultiple] = useState(existingLookup?.multiple ?? false);
  const [lookupChecklist, setLookupChecklist] = useState(existingLookup?.checklist ?? false);
  const [lookupChecklistHeight, setLookupChecklistHeight] = useState(existingLookup?.checklistHeight !== undefined && existingLookup?.checklistHeight !== null ? String(existingLookup.checklistHeight) : "");
  const [lookupChecklistPageSize, setLookupChecklistPageSize] = useState(existingLookup?.checklistPageSize !== undefined && existingLookup?.checklistPageSize !== null ? String(existingLookup.checklistPageSize) : "");
  const [lookupPreload, setLookupPreload] = useState(existingLookup?.preload ?? false);
  const [lookupReadOnly, setLookupReadOnly] = useState(existingLookup?.readOnly ?? false);
  const [lookupMinChars, setLookupMinChars] = useState(existingLookup?.minChars !== undefined && existingLookup?.minChars !== null ? String(existingLookup.minChars) : "");
  const [lookupDropdownLimit, setLookupDropdownLimit] = useState(existingLookup?.dropdownLimit !== undefined && existingLookup?.dropdownLimit !== null ? String(existingLookup.dropdownLimit) : "");
  const [lookupAllOptionValue, setLookupAllOptionValue] = useState(existingLookup?.allOptionValue ?? "");
  const [lookupAllOptionLabel, setLookupAllOptionLabel] = useState(existingLookup?.allOptionLabel ?? "");
  const [lookupFieldMap, setLookupFieldMap] = useState<LookupFieldMapEntry[]>(existingLookup?.fieldMap ?? []);
  const [lookupHandlerName, setLookupHandlerName] = useState(existingLookup?.handlerName ?? "");
  const [lookupHydrateNonTransient, setLookupHydrateNonTransient] = useState(existingLookup?.hydrateNonTransient ?? false);

  const handleLookupSourceTypeChange = (nextType: LookupSourceType) => {
    setLookupSourceType(nextType);
    if (nextType !== "qad_getdata") return;

    setUseDefaultValueField(false);
    setUseDefaultDisplayField(false);
    setUseDefaultDisplayTemplate(false);
    setUseDefaultSearchColumns(false);
    setUseDefaultDropdownColumns(false);
    setUseDefaultGridColumns(false);
    setUseDefaultBrowseTitle(false);
    setUseDefaultMinChars(false);
    setUseDefaultDropdownLimit(false);

    setLookupValueField("");
    setLookupDisplayField("");
    setLookupDisplayTemplate("");
    setLookupSearchColumns([]);
    setLookupSearchColumnsText("");
    setLookupDropdownColumns([]);
    setLookupDropdownColumnsText("");
    setLookupGridColumns([]);
    setLookupGridColumnsText("");
    setLookupBrowseTitle("");

    setLookupBrowsable(true);
    setLookupMultiple(false);
    setLookupChecklist(false);
    setLookupPreload(false);
    setUseDefaultBrowsable(false);
    setUseDefaultMultiple(false);
    setUseDefaultChecklist(false);
    setUseDefaultPreload(false);
  };

  const defaultLookupConfig = useMemo(() => {
    if (lookupSourceType === "preset") {
      const presetName = lookupPresetName === "current" ? (existingLookup?.presetName ?? "current") : lookupPresetName;
      const presetDefinition = presetName && presetName !== "current"
        ? ({ sourceType: "preset", presetName } as const)
        : extractLookupDefinition(field.lookupConfig);
      return buildLookupConfig(presetDefinition, field.lookupConfig);
    }

    if (lookupSourceType === "datasource") {
      return buildLookupConfig({ sourceType: "datasource", dataSourceName: lookupDataSourceName }, field.lookupConfig);
    }

    if (lookupSourceType === "qad_getdata") {
      return buildLookupConfig({
        sourceType: "qad_getdata",
        qadDsName: lookupQadDsName,
        qadSearchWhere: lookupQadSearchWhere,
        qadUniqueWhere: lookupQadUniqueWhere,
        qadFieldSet: lookupQadFieldSet,
        valueField: lookupValueField,
        displayField: lookupDisplayField,
        displayTemplate: lookupDisplayTemplate,
        searchColumns: lookupSearchColumns,
        gridColumns: lookupGridColumns,
        placeholder: placeholder,
      }, field.lookupConfig);
    }

    return buildLookupConfig({ sourceType: "api", apiPath: lookupApiPath, valueField: lookupValueField, displayField: lookupDisplayField }, field.lookupConfig);
  }, [lookupSourceType, lookupPresetName, lookupDataSourceName, lookupApiPath, lookupQadDsName, lookupQadSearchWhere, lookupQadUniqueWhere, lookupQadFieldSet, lookupValueField, lookupDisplayField, lookupDisplayTemplate, lookupSearchColumns, lookupGridColumns, placeholder, existingLookup?.presetName, field.lookupConfig]);

  const defaultLookup = useMemo(() => ({
    apiPath: defaultLookupConfig?.apiPath ?? "",
    valueField: defaultLookupConfig?.valueField ?? "",
    displayField: defaultLookupConfig?.displayField ?? "",
    displayTemplate: defaultLookupConfig?.displayTemplate ?? "",
    placeholder: defaultLookupConfig?.placeholder ?? "",
    searchColumns: defaultLookupConfig?.searchColumns ?? [],
    dropdownColumns: (defaultLookupConfig?.dropdownColumns ?? []).map(col => typeof col === "string" ? col : col.key),
    gridColumns: (defaultLookupConfig?.gridColumns ?? []).map(col => String(col?.key ?? "").trim()).filter(Boolean),
    browsable: defaultLookupConfig?.browsable ?? true,
    browseTitle: defaultLookupConfig?.browseTitle ?? "",
    multiple: defaultLookupConfig?.multiple ?? false,
    checklist: defaultLookupConfig?.checklist ?? false,
    checklistHeight: defaultLookupConfig?.checklistHeight,
    checklistPageSize: defaultLookupConfig?.checklistPageSize,
    preload: defaultLookupConfig?.preload ?? false,
    readOnly: defaultLookupConfig?.readOnly ?? false,
    minChars: defaultLookupConfig?.minChars,
    dropdownLimit: defaultLookupConfig?.dropdownLimit,
    allOptionValue: defaultLookupConfig?.allOption?.value ?? "",
    allOptionLabel: defaultLookupConfig?.allOption?.label ?? "",
    fieldMap: existingLookup?.fieldMap,
    handlerName: existingLookup?.handlerName ?? "",
    hydrateNonTransient: existingLookup?.hydrateNonTransient ?? false,
  }), [defaultLookupConfig, existingLookup?.fieldMap, existingLookup?.handlerName, existingLookup?.hydrateNonTransient]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRemove = useMemo(() => isDesignerAddedField(panel, field.key), [panel, field]);
  const showLookupSettings = renderer === "lookup";

  const effectiveLookup = {
    apiPath: useDefaultApiPath ? defaultLookup?.apiPath ?? "" : lookupApiPath,
    valueField: useDefaultValueField ? defaultLookup?.valueField ?? "" : lookupValueField,
    displayField: useDefaultDisplayField ? defaultLookup?.displayField ?? "" : lookupDisplayField,
    displayTemplate: useDefaultDisplayTemplate ? defaultLookup?.displayTemplate ?? "" : lookupDisplayTemplate,
    placeholder: useDefaultPlaceholder ? defaultLookup?.placeholder ?? "" : placeholder,
    searchColumns: useDefaultSearchColumns ? defaultLookup?.searchColumns ?? [] : lookupSearchColumns,
    dropdownColumns: useDefaultDropdownColumns ? defaultLookup?.dropdownColumns ?? [] : lookupDropdownColumns,
    gridColumns: useDefaultGridColumns ? defaultLookup?.gridColumns ?? [] : lookupGridColumns,
    browsable: useDefaultBrowsable ? (defaultLookup?.browsable ?? true) : lookupBrowsable,
    browseTitle: useDefaultBrowseTitle ? defaultLookup?.browseTitle ?? "" : lookupBrowseTitle,
    multiple: useDefaultMultiple ? (defaultLookup?.multiple ?? false) : lookupMultiple,
    checklist: useDefaultChecklist ? (defaultLookup?.checklist ?? false) : lookupChecklist,
    checklistHeight: useDefaultChecklistHeight ? String(defaultLookup?.checklistHeight ?? "") : lookupChecklistHeight,
    checklistPageSize: useDefaultChecklistPageSize ? String(defaultLookup?.checklistPageSize ?? "") : lookupChecklistPageSize,
    preload: useDefaultPreload ? (defaultLookup?.preload ?? false) : lookupPreload,
    lookupReadOnly: useDefaultLookupReadOnly ? (defaultLookup?.readOnly ?? false) : lookupReadOnly,
    minChars: useDefaultMinChars ? String(defaultLookup?.minChars ?? "") : lookupMinChars,
    dropdownLimit: useDefaultDropdownLimit ? String(defaultLookup?.dropdownLimit ?? "") : lookupDropdownLimit,
    allOptionValue: useDefaultAllOption ? defaultLookup?.allOptionValue ?? "" : lookupAllOptionValue,
    allOptionLabel: useDefaultAllOption ? defaultLookup?.allOptionLabel ?? "" : lookupAllOptionLabel,
    fieldMap: useDefaultFieldMap ? (defaultLookup?.fieldMap ?? []) : lookupFieldMap,
    handlerName: useDefaultHandlerName ? defaultLookup?.handlerName ?? "" : lookupHandlerName,
    hydrateNonTransient: useDefaultHydrateNonTransient ? (defaultLookup?.hydrateNonTransient ?? false) : lookupHydrateNonTransient,
  };

  const buildLookupDefinitionForSave = () => {
    if (renderer !== "lookup") return undefined;
    const effectivePreset = lookupPresetName === "current" && !field.lookupConfig && !existing.lookupDefinition ? "custom" : lookupPresetName;
    const definition: Record<string, unknown> = { sourceType: lookupSourceType };
    if (lookupSourceType === "preset") definition.presetName = effectivePreset;
    if (lookupSourceType === "datasource") definition.dataSourceName = lookupDataSourceName;
    if (lookupSourceType === "api" && !useDefaultApiPath) definition.apiPath = lookupApiPath.trim() || undefined;
    if (lookupSourceType === "qad_getdata") {
      definition.qadDsName = lookupQadDsName.trim() || undefined;
      definition.qadSearchWhere = lookupQadSearchWhere.trim() || undefined;
      definition.qadUniqueWhere = lookupQadUniqueWhere.trim() || undefined;
      definition.qadFieldSet = lookupQadFieldSet.trim() || undefined;
      definition.valueField = lookupValueField.trim() || undefined;
      definition.displayField = lookupDisplayField.trim() || undefined;
      definition.displayTemplate = lookupDisplayTemplate.trim() || undefined;
      definition.searchColumns = parseDelimitedList(lookupSearchColumnsText);
      definition.dropdownColumns = parseDelimitedList(lookupDropdownColumnsText);
      definition.gridColumns = parseDelimitedList(lookupGridColumnsText);
      definition.browsable = lookupBrowsable;
      definition.browseTitle = lookupBrowseTitle.trim() || undefined;
      definition.multiple = lookupMultiple;
      definition.checklist = lookupChecklist;
      definition.preload = lookupPreload;
      definition.readOnly = lookupReadOnly;
      definition.minChars = lookupMinChars.trim() ? Number(lookupMinChars) : undefined;
      definition.dropdownLimit = lookupDropdownLimit.trim() ? Number(lookupDropdownLimit) : undefined;
    }
    if (lookupSourceType !== "qad_getdata" && !useDefaultValueField) definition.valueField = lookupValueField.trim() || undefined;
    if (lookupSourceType !== "qad_getdata" && !useDefaultDisplayField) definition.displayField = lookupDisplayField.trim() || undefined;
    if (lookupSourceType !== "qad_getdata" && !useDefaultDisplayTemplate) definition.displayTemplate = lookupDisplayTemplate.trim() || undefined;
    if (!useDefaultPlaceholder) definition.placeholder = placeholder.trim() || undefined;
    if (lookupSourceType !== "qad_getdata" && !useDefaultSearchColumns) definition.searchColumns = lookupSearchColumns;
    if (lookupSourceType !== "qad_getdata" && !useDefaultDropdownColumns) definition.dropdownColumns = lookupDropdownColumns;
    if (lookupSourceType !== "qad_getdata" && !useDefaultGridColumns) definition.gridColumns = lookupGridColumns;
    if (lookupSourceType !== "qad_getdata" && !useDefaultBrowsable) definition.browsable = lookupBrowsable;
    if (lookupSourceType !== "qad_getdata" && !useDefaultBrowseTitle) definition.browseTitle = lookupBrowseTitle.trim() || undefined;
    if (lookupSourceType !== "qad_getdata" && !useDefaultMultiple) definition.multiple = lookupMultiple;
    if (lookupSourceType !== "qad_getdata" && !useDefaultChecklist) definition.checklist = lookupChecklist;
    if (!useDefaultChecklistHeight) definition.checklistHeight = lookupChecklistHeight.trim() ? Number(lookupChecklistHeight) : undefined;
    if (!useDefaultChecklistPageSize) definition.checklistPageSize = lookupChecklistPageSize.trim() ? Number(lookupChecklistPageSize) : undefined;
    if (lookupSourceType !== "qad_getdata" && !useDefaultPreload) definition.preload = lookupPreload;
    if (lookupSourceType !== "qad_getdata" && !useDefaultLookupReadOnly) definition.readOnly = lookupReadOnly;
    if (lookupSourceType !== "qad_getdata" && !useDefaultMinChars) definition.minChars = lookupMinChars.trim() ? Number(lookupMinChars) : undefined;
    if (lookupSourceType !== "qad_getdata" && !useDefaultDropdownLimit) definition.dropdownLimit = lookupDropdownLimit.trim() ? Number(lookupDropdownLimit) : undefined;
    if (!useDefaultAllOption) {
      definition.allOptionValue = lookupAllOptionValue.trim() || undefined;
      definition.allOptionLabel = lookupAllOptionLabel.trim() || undefined;
    }
    if (!useDefaultFieldMap) definition.fieldMap = lookupFieldMap.filter(mapping => mapping.source && mapping.target);
    if (!useDefaultHandlerName) definition.handlerName = lookupHandlerName.trim() || undefined;
    if (!useDefaultHydrateNonTransient) definition.hydrateNonTransient = lookupHydrateNonTransient;
    return serializeLookupDefinition(definition);
  };

  const lookupSourceConfig = useMemo(() => buildLookupConfig(buildLookupDefinitionForSave(), field.lookupConfig), [
    renderer,
    lookupSourceType,
    lookupDataSourceName,
    lookupPresetName,
    useDefaultApiPath,
    lookupApiPath,
    useDefaultValueField,
    lookupValueField,
    useDefaultDisplayField,
    lookupDisplayField,
    useDefaultDisplayTemplate,
    lookupDisplayTemplate,
    useDefaultPlaceholder,
    placeholder,
    useDefaultSearchColumns,
    lookupSearchColumns,
    useDefaultDropdownColumns,
    lookupDropdownColumns,
    useDefaultGridColumns,
    lookupGridColumns,
    useDefaultBrowsable,
    lookupBrowsable,
    useDefaultBrowseTitle,
    lookupBrowseTitle,
    useDefaultMultiple,
    lookupMultiple,
    useDefaultChecklist,
    lookupChecklist,
    useDefaultChecklistHeight,
    lookupChecklistHeight,
    useDefaultChecklistPageSize,
    lookupChecklistPageSize,
    useDefaultPreload,
    lookupPreload,
    useDefaultLookupReadOnly,
    lookupReadOnly,
    useDefaultMinChars,
    lookupMinChars,
    useDefaultDropdownLimit,
    lookupDropdownLimit,
    useDefaultAllOption,
    lookupAllOptionValue,
    lookupAllOptionLabel,
    useDefaultFieldMap,
    lookupFieldMap,
    useDefaultHandlerName,
    lookupHandlerName,
    useDefaultHydrateNonTransient,
    lookupHydrateNonTransient,
    field.lookupConfig,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadLookupColumns() {
      const ds = lookupSourceConfig?.dataSource ?? defaultLookupConfig?.dataSource;
      if (ds) {
        await ds.loadColumns();
        if (cancelled) return;
        const keys = ds.columns.map(col => col.key);
        setLookupSourceColumns(keys.length ? keys : getLookupColumnCandidates(lookupSourceConfig));
        return;
      }

      const apiPath = String(lookupSourceConfig?.apiPath ?? effectiveLookup.apiPath ?? "").trim();
      if (lookupSourceType === "api" && apiPath.startsWith("/api/")) {
        try {
          const qs = apiPath.includes("?") ? "&columns=1" : "?columns=1";
          const res = await fetch(`${apiPath}${qs}`, { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            const keys = Array.isArray(json?.columns) ? json.columns.map((col: any) => String(col?.key ?? "").trim()).filter(Boolean) : [];
            if (!cancelled && keys.length) {
              setLookupSourceColumns(keys);
              return;
            }
          }
        } catch {
          // Fall back to any statically-declared lookup columns below.
        }
      }

      setLookupSourceColumns(getLookupColumnCandidates(lookupSourceConfig));
    }

    void loadLookupColumns();
    return () => {
      cancelled = true;
    };
  }, [lookupSourceConfig, defaultLookupConfig, effectiveLookup.apiPath, lookupSourceType]);

  useEffect(() => {
    if (lookupSourceType !== "qad_getdata") return;
    if (!sessionDomain) return;
    let cancelled = false;
    fetch(`/api/qad/config?domain=${encodeURIComponent(sessionDomain)}`)
      .then(async res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled) setQadConfigMeta(data); })
      .catch(() => { if (!cancelled) setQadConfigMeta(null); });
    return () => { cancelled = true; };
  }, [lookupSourceType, sessionDomain]);

  useEffect(() => {
    if (lookupSourceType !== "qad_getdata") return;
    const cols = parseDelimitedList(lookupQadFieldSet);
    if (cols.length) setLookupSourceColumns(cols);
  }, [lookupSourceType, lookupQadFieldSet]);

  const isQadGetData = lookupSourceType === "qad_getdata";
  const lookupFieldOptions = uniqueKeys([
    ...lookupSourceColumns,
    effectiveLookup.valueField,
    effectiveLookup.displayField,
    ...(effectiveLookup.searchColumns ?? []),
    ...(effectiveLookup.dropdownColumns ?? []),
    ...(effectiveLookup.gridColumns ?? []),
    lookupValueField,
    lookupDisplayField,
    ...(isQadGetData ? parseDelimitedList(lookupSearchColumnsText) : lookupSearchColumns),
    ...(isQadGetData ? parseDelimitedList(lookupDropdownColumnsText) : lookupDropdownColumns),
    ...(isQadGetData ? parseDelimitedList(lookupGridColumnsText) : lookupGridColumns),
  ]);
  const hasLookupSchemaHelpers = lookupSourceColumns.length > 0;
  const useManualLookupFieldEntry = isQadGetData || (lookupSourceType === "api" && !hasLookupSchemaHelpers);
  const showBrowseControls = isQadGetData ? lookupBrowsable : !!effectiveLookup.browsable;
  const showChecklistSizing = isQadGetData ? lookupChecklist : !!effectiveLookup.checklist;
  const columnKeys = lookupFieldOptions;
  const columnOptions = [{ value: "", label: "—" }, ...lookupFieldOptions.map(key => ({ value: key, label: key }))];

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isCustom) {
        await saveCustomFieldDefinition(panel, field.key, {
          label: label.trim(),
          dataType: customDataType as any,
          renderer,
          maxLength: maxLength.trim() ? Number(maxLength) : undefined,
          scale: scale.trim() ? Number(scale) : undefined,
          transient: customDef?.transient === true,
        });
      }
      if (sectionKey && sectionKey !== getFieldParentKey(panel, field.key)) {
        await moveFieldLayout(panel, field, sectionKey);
      }
      await saveFieldLayoutSettings(panel, panel.getField(field.key), {
        label: label.trim(),
        hidden,
        readOnly,
        required,
        renderer,
        placeholder: placeholder.trim(),
        maxLength: maxLength.trim() ? Number(maxLength) : undefined,
        scale: scale.trim() ? Number(scale) : undefined,
        lookupDefinition: buildLookupDefinitionForSave(),
      });
      DrawerService.pop();
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Field
        </div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {field.key}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Label
        </label>
        <Input value={label} onChange={setLabel} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Section
        </label>
        <Select
          value={sectionKey}
          onChange={v => setSectionKey(String(v))}
          options={panel.sections.map(section => ({ value: section.key, label: section.getLabel() || section.key }))}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Renderer
          </label>
          <Select
            value={renderer}
            onChange={v => setRenderer(String(v))}
            options={[
              { value: "text", label: "Text" },
              { value: "number", label: "Number" },
              { value: "date", label: "Date" },
              { value: "datetime", label: "Date/Time" },
              { value: "boolean", label: "Boolean" },
              { value: "lookup", label: "Lookup" },
              { value: "textarea", label: "Textarea" },
              { value: "password", label: "Password" },
              { value: "readonly", label: "Read Only" },
            ]}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Placeholder
          </label>
          <Input value={placeholder} onChange={setPlaceholder} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Max Length
          </label>
          <Input value={maxLength} onChange={setMaxLength} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Scale
          </label>
          <Input value={scale} onChange={setScale} />
        </div>
      </div>

      {showLookupSettings && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface-alt)" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Lookup
          </div>
          {useManualLookupFieldEntry && (
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
              This lookup does not expose schema metadata yet. Enter field names manually for value, display, search, dropdown, and browse columns.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Lookup Source
              </label>
              <Select value={lookupSourceType} onChange={v => handleLookupSourceTypeChange(String(v) as LookupSourceType)} options={LOOKUP_SOURCE_OPTIONS} />
            </div>
            {lookupSourceType === "preset" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Preset
                </label>
                <Select value={lookupPresetName} onChange={v => setLookupPresetName(String(v) as LookupPresetName)} options={LOOKUP_PRESET_OPTIONS} />
              </div>
            )}
            {lookupSourceType === "datasource" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Data Source
                </label>
                <Select value={lookupDataSourceName} onChange={v => setLookupDataSourceName(String(v) as LookupDataSourceName)} options={LOOKUP_DATASOURCE_OPTIONS} />
              </div>
            )}
            {lookupSourceType === "api" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>API Path</label>
                <Input value={effectiveLookup.apiPath} onChange={setLookupApiPath} readOnly={useDefaultApiPath} />
                <ToggleDefault checked={useDefaultApiPath} onChange={setUseDefaultApiPath} />
              </div>
            )}
            {lookupSourceType === "qad_getdata" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>QAD Source Name</label>
                <Input value={lookupQadDsName} onChange={setLookupQadDsName} />
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Type any table name directly, or use one of the predefined datasets from config.xml.</div>
                {!!qadConfigMeta?.datasets?.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {qadConfigMeta.datasets.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setLookupQadDsName(item.name)}
                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.72rem" }}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {lookupSourceType === "qad_getdata" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>QAD Search Where</label>
                  <Input value={lookupQadSearchWhere} onChange={setLookupQadSearchWhere} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>QAD Unique Where</label>
                  <Input value={lookupQadUniqueWhere} onChange={setLookupQadUniqueWhere} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>QAD Field Set</label>
                  <Input value={lookupQadFieldSet} onChange={setLookupQadFieldSet} />
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Comma-separated getData field list. Used to derive lookup columns.</div>
                </div>
              </>
            )}
            {showBrowseControls && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Browse Title</label>
                <Input value={isQadGetData ? lookupBrowseTitle : effectiveLookup.browseTitle} onChange={setLookupBrowseTitle} readOnly={!isQadGetData && useDefaultBrowseTitle} />
                {!isQadGetData && <ToggleDefault checked={useDefaultBrowseTitle} onChange={setUseDefaultBrowseTitle} />}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Value Field</label>
              {isQadGetData
                ? <Input value={lookupValueField} onChange={setLookupValueField} />
                : useDefaultValueField
                  ? <Input value={effectiveLookup.valueField} readOnly />
                  : useManualLookupFieldEntry
                    ? <Input value={effectiveLookup.valueField} onChange={setLookupValueField} />
                    : <Select value={effectiveLookup.valueField} onChange={setLookupValueField} options={columnOptions} />}
              {!isQadGetData && <ToggleDefault checked={useDefaultValueField} onChange={setUseDefaultValueField} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Display Field</label>
              {isQadGetData
                ? <Input value={lookupDisplayField} onChange={setLookupDisplayField} />
                : useDefaultDisplayField
                  ? <Input value={effectiveLookup.displayField} readOnly />
                  : useManualLookupFieldEntry
                    ? <Input value={effectiveLookup.displayField} onChange={setLookupDisplayField} />
                    : <Select value={effectiveLookup.displayField} onChange={setLookupDisplayField} options={columnOptions} />}
              {!isQadGetData && <ToggleDefault checked={useDefaultDisplayField} onChange={setUseDefaultDisplayField} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Display Template</label>
              <Input value={isQadGetData ? lookupDisplayTemplate : effectiveLookup.displayTemplate} onChange={setLookupDisplayTemplate} readOnly={!isQadGetData && useDefaultDisplayTemplate} />
              {!isQadGetData && <ToggleDefault checked={useDefaultDisplayTemplate} onChange={setUseDefaultDisplayTemplate} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Search Columns</label>
              {isQadGetData
                ? <Input value={lookupSearchColumnsText} onChange={setLookupSearchColumnsText} />
                : useDefaultSearchColumns
                  ? <Input value={effectiveLookup.searchColumns.join(", ")} readOnly />
                  : useManualLookupFieldEntry
                    ? <Input value={effectiveLookup.searchColumns.join(", ")} onChange={value => setLookupSearchColumns(parseDelimitedList(value))} />
                    : <MultiSelectChecks options={lookupFieldOptions} selected={effectiveLookup.searchColumns} onChange={setLookupSearchColumns} />}
              {!isQadGetData && <ToggleDefault checked={useDefaultSearchColumns} onChange={setUseDefaultSearchColumns} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dropdown Columns</label>
              {isQadGetData
                ? <Input value={lookupDropdownColumnsText} onChange={setLookupDropdownColumnsText} />
                : useDefaultDropdownColumns
                  ? <Input value={effectiveLookup.dropdownColumns.join(", ")} readOnly />
                  : useManualLookupFieldEntry
                    ? <Input value={effectiveLookup.dropdownColumns.join(", ")} onChange={value => setLookupDropdownColumns(parseDelimitedList(value))} />
                    : <MultiSelectChecks options={lookupFieldOptions} selected={effectiveLookup.dropdownColumns} onChange={setLookupDropdownColumns} />}
              {!isQadGetData && <ToggleDefault checked={useDefaultDropdownColumns} onChange={setUseDefaultDropdownColumns} />}
            </div>
            {showBrowseControls && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Browse Grid Columns</label>
                {isQadGetData
                  ? <Input value={lookupGridColumnsText} onChange={setLookupGridColumnsText} />
                  : useDefaultGridColumns
                    ? <Input value={effectiveLookup.gridColumns.join(", ")} readOnly />
                    : useManualLookupFieldEntry
                      ? <Input value={effectiveLookup.gridColumns.join(", ")} onChange={value => setLookupGridColumns(parseDelimitedList(value))} />
                      : <MultiSelectChecks options={lookupFieldOptions} selected={effectiveLookup.gridColumns} onChange={setLookupGridColumns} />}
                {!isQadGetData && <ToggleDefault checked={useDefaultGridColumns} onChange={setUseDefaultGridColumns} />}
              </div>
            )}
            {showChecklistSizing && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Checklist Height</label>
                  <Input value={effectiveLookup.checklistHeight} onChange={setLookupChecklistHeight} readOnly={useDefaultChecklistHeight} />
                  <ToggleDefault checked={useDefaultChecklistHeight} onChange={setUseDefaultChecklistHeight} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Checklist Page Size</label>
                  <Input value={effectiveLookup.checklistPageSize} onChange={setLookupChecklistPageSize} readOnly={useDefaultChecklistPageSize} />
                  <ToggleDefault checked={useDefaultChecklistPageSize} onChange={setUseDefaultChecklistPageSize} />
                </div>
              </>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Min Chars</label>
              <Input value={isQadGetData ? lookupMinChars : effectiveLookup.minChars} onChange={setLookupMinChars} readOnly={!isQadGetData && useDefaultMinChars} />
              {!isQadGetData && <ToggleDefault checked={useDefaultMinChars} onChange={setUseDefaultMinChars} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dropdown Limit</label>
              <Input value={isQadGetData ? lookupDropdownLimit : effectiveLookup.dropdownLimit} onChange={setLookupDropdownLimit} readOnly={!isQadGetData && useDefaultDropdownLimit} />
              {!isQadGetData && <ToggleDefault checked={useDefaultDropdownLimit} onChange={setUseDefaultDropdownLimit} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>All Option Value</label>
              <Input value={effectiveLookup.allOptionValue} onChange={setLookupAllOptionValue} readOnly={useDefaultAllOption} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>All Option Label</label>
              <Input value={effectiveLookup.allOptionLabel} onChange={setLookupAllOptionLabel} readOnly={useDefaultAllOption} />
              <ToggleDefault checked={useDefaultAllOption} onChange={setUseDefaultAllOption} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Lookup Handler</label>
              {useDefaultHandlerName ? (
                <Input value={effectiveLookup.handlerName} readOnly />
              ) : lookupHandlerOptions.length > 0 ? (
                <Select value={effectiveLookup.handlerName} onChange={setLookupHandlerName} options={[{ value: "", label: "—" }, ...lookupHandlerOptions.map(option => ({ value: option.key, label: option.label }))]} />
              ) : (
                <Input value={effectiveLookup.handlerName} onChange={setLookupHandlerName} />
              )}
              <ToggleDefault checked={useDefaultHandlerName} onChange={setUseDefaultHandlerName} />
              {lookupHandlerOptions.length > 0 && !useDefaultHandlerName && (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {lookupHandlerOptions.find(option => option.key === effectiveLookup.handlerName)?.description || "Handlers come from the current page override."}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Field Map</label>
              {useDefaultFieldMap ? (
                <Input value={stringifyFieldMap(effectiveLookup.fieldMap)} readOnly />
              ) : (
                <FieldMapEditor mappings={effectiveLookup.fieldMap} sourceOptions={lookupFieldOptions} targetOptions={panelFieldKeys} onChange={setLookupFieldMap} />
              )}
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Map lookup fields into panel fields after select or clear.</div>
              <ToggleDefault checked={useDefaultFieldMap} onChange={setUseDefaultFieldMap} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Browsable</span>
              <Toggle value={isQadGetData ? lookupBrowsable : effectiveLookup.browsable} onChange={v => setLookupBrowsable(!!v)} readOnly={!isQadGetData && useDefaultBrowsable} />
            </label>
            {!isQadGetData && <ToggleDefault checked={useDefaultBrowsable} onChange={setUseDefaultBrowsable} />}

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Multiple</span>
              <Toggle value={isQadGetData ? lookupMultiple : effectiveLookup.multiple} onChange={v => setLookupMultiple(!!v)} readOnly={!isQadGetData && useDefaultMultiple} />
            </label>
            {!isQadGetData && <ToggleDefault checked={useDefaultMultiple} onChange={setUseDefaultMultiple} />}

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Checklist</span>
              <Toggle value={isQadGetData ? lookupChecklist : effectiveLookup.checklist} onChange={v => setLookupChecklist(!!v)} readOnly={!isQadGetData && useDefaultChecklist} />
            </label>
            {!isQadGetData && <ToggleDefault checked={useDefaultChecklist} onChange={setUseDefaultChecklist} />}

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Preload</span>
              <Toggle value={isQadGetData ? lookupPreload : effectiveLookup.preload} onChange={v => setLookupPreload(!!v)} readOnly={!isQadGetData && useDefaultPreload} />
            </label>
            {!isQadGetData && <ToggleDefault checked={useDefaultPreload} onChange={setUseDefaultPreload} />}

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Lookup Read Only</span>
              <Toggle value={effectiveLookup.lookupReadOnly} onChange={v => setLookupReadOnly(!!v)} readOnly={useDefaultLookupReadOnly} />
            </label>
            <ToggleDefault checked={useDefaultLookupReadOnly} onChange={setUseDefaultLookupReadOnly} />

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Hydrate Non-Transient</span>
              <Toggle value={effectiveLookup.hydrateNonTransient} onChange={v => setLookupHydrateNonTransient(!!v)} readOnly={useDefaultHydrateNonTransient} />
            </label>
            <ToggleDefault checked={useDefaultHydrateNonTransient} onChange={setUseDefaultHydrateNonTransient} />
          </div>
        </div>
      )}

      {isCustom && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Custom Field Key
            </label>
            <Input value={field.key} readOnly />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Data Type
            </label>
            <Select
              value={customDataType}
              onChange={v => setCustomDataType(String(v) as any)}
              options={[
                { value: "text", label: "Text" },
                { value: "number", label: "Number" },
                { value: "boolean", label: "Boolean" },
                { value: "date", label: "Date" },
                { value: "datetime", label: "Date/Time" },
                { value: "image", label: "Image" },
              ]}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", fontSize: "0.74rem", color: "var(--text-muted)" }}>
            Data type changes are allowed only while no saved records contain a value for this custom field.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Hidden</span>
          <Toggle value={hidden} onChange={v => setHidden(!!v)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Read Only</span>
          <Toggle value={readOnly} onChange={v => setReadOnly(!!v)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Required</span>
          <Toggle value={required} onChange={v => setRequired(!!v)} />
        </label>
      </div>

      {error && <div style={{ color: "var(--danger-text, #e53e3e)", fontSize: "0.78rem" }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await moveFieldLayout(panel, field, getFieldParentKey(panel, field.key), "up");
              } catch (err: any) {
                setError(err?.message || "Move failed");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer" }}
          >
            Move Up
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await moveFieldLayout(panel, field, getFieldParentKey(panel, field.key), "down");
              } catch (err: any) {
                setError(err?.message || "Move failed");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer" }}
          >
            Move Down
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isCustom && (
            <button
              onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  await removeCustomFieldDefinition(panel, field.key);
                  DrawerService.pop();
                } catch (err: any) {
                  setError(err?.message || "Remove custom field failed");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--danger-text, #e53e3e)", background: "transparent", color: "var(--danger-text, #e53e3e)", cursor: saving ? "not-allowed" : "pointer" }}
            >
              Remove Custom Field
            </button>
          )}
          {!isCustom && canRemove && (
            <button
              onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  await removeFieldLayout(panel, field);
                  DrawerService.pop();
                } catch (err: any) {
                  setError(err?.message || "Remove failed");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--danger-text, #e53e3e)", background: "transparent", color: "var(--danger-text, #e53e3e)", cursor: saving ? "not-allowed" : "pointer" }}
            >
              Remove
            </button>
          )}
          <button
            onClick={() => DrawerService.pop()}
            disabled={saving}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent)", color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
