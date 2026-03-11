import type { LookupConfig } from "@/components/lookup/LookupTypes";
import { DomainLookup } from "@/components/lookup/presets/DomainLookup";
import { GroupLookup, ActiveGroupLookup } from "@/components/lookup/presets/GroupLookup";
import { LocaleLookup } from "@/components/lookup/presets/LocaleLookup";
import { UserLookup, ActiveUserLookup } from "@/components/lookup/presets/UserLookup";
import { GroupDataSource } from "@/platform/pages/groups/GroupDataSource";
import { LocaleDataSource } from "@/platform/pages/locales/LocaleDataSource";
import { PasoeDataSource } from "@/platform/pages/pasoe_brokers/PasoeDataSource";
import { SettingsDataSource } from "@/platform/pages/settings/SettingsDataSource";
import { SsoDataSource } from "@/platform/pages/sso_config/SsoDataSource";
import { TranslationDataSource } from "@/platform/pages/translations/TranslationDataSource";
import { UserDataSource } from "@/platform/pages/users/UserDataSource";

export type LookupPresetName = "current" | "custom" | "domain" | "group" | "active_group" | "locale" | "user" | "active_user";
export type LookupSourceType = "preset" | "datasource" | "api";
export type LookupDataSourceName = "groups" | "locales" | "users" | "settings" | "translations" | "pasoe_brokers" | "sso_config";

export interface LookupFieldMapEntry {
  source: string;
  target: string;
}

export interface LookupDefinition {
  sourceType?: LookupSourceType;
  presetName?: LookupPresetName;
  dataSourceName?: LookupDataSourceName;
  apiPath?: string;
  valueField?: string;
  displayField?: string;
  displayTemplate?: string;
  placeholder?: string;
  searchColumns?: string[];
  dropdownColumns?: string[];
  gridColumns?: string[];
  browsable?: boolean;
  browseTitle?: string;
  multiple?: boolean;
  checklist?: boolean;
  checklistHeight?: number;
  checklistPageSize?: number;
  preload?: boolean;
  readOnly?: boolean;
  minChars?: number;
  dropdownLimit?: number;
  allOptionValue?: string;
  allOptionLabel?: string;
  fieldMap?: LookupFieldMapEntry[];
  handlerName?: string;
  hydrateNonTransient?: boolean;
}

export const LOOKUP_SOURCE_OPTIONS: Array<{ value: LookupSourceType; label: string }> = [
  { value: "preset", label: "Preset" },
  { value: "datasource", label: "Data Source" },
  { value: "api", label: "API Path" },
];

export const LOOKUP_PRESET_OPTIONS: Array<{ value: LookupPresetName; label: string }> = [
  { value: "current", label: "Current / Existing" },
  { value: "domain", label: "Domain" },
  { value: "group", label: "Group" },
  { value: "active_group", label: "Active Group" },
  { value: "locale", label: "Locale" },
  { value: "user", label: "User" },
  { value: "active_user", label: "Active User" },
];

export const LOOKUP_DATASOURCE_OPTIONS: Array<{ value: LookupDataSourceName; label: string }> = [
  { value: "groups", label: "Groups" },
  { value: "locales", label: "Locales" },
  { value: "users", label: "Users" },
  { value: "settings", label: "Settings" },
  { value: "translations", label: "Translations" },
  { value: "pasoe_brokers", label: "PASOE Brokers" },
  { value: "sso_config", label: "SSO Providers" },
];

function toLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(item => String(item ?? "").trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function pickSerializable(config: LookupConfig | undefined): LookupDefinition | undefined {
  if (!config) return undefined;
  return {
    apiPath: asString(config.apiPath),
    valueField: asString(config.valueField),
    displayField: asString(config.displayField),
    displayTemplate: asString(config.displayTemplate),
    placeholder: asString(config.placeholder),
    searchColumns: asStringArray(config.searchColumns),
    dropdownColumns: Array.isArray(config.dropdownColumns)
      ? config.dropdownColumns
          .map(col => (typeof col === "string" ? col : String(col?.key ?? "").trim()))
          .filter(Boolean)
      : undefined,
    gridColumns: Array.isArray(config.gridColumns)
      ? config.gridColumns.map(col => String((col as any)?.key ?? "").trim()).filter(Boolean)
      : undefined,
    browsable: asBoolean(config.browsable),
    browseTitle: asString(config.browseTitle),
    multiple: asBoolean(config.multiple),
    checklist: asBoolean(config.checklist),
    checklistHeight: asNumber(config.checklistHeight),
    checklistPageSize: asNumber(config.checklistPageSize),
    preload: asBoolean(config.preload),
    readOnly: asBoolean(config.readOnly),
    minChars: asNumber(config.minChars),
    dropdownLimit: asNumber(config.dropdownLimit),
    allOptionValue: asString(config.allOption?.value),
    allOptionLabel: asString(config.allOption?.label),
  };
}

function normalizeFieldMap(value: unknown): LookupFieldMapEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = asString((item as Record<string, unknown>).source);
      const target = asString((item as Record<string, unknown>).target);
      return source && target ? { source, target } : null;
    })
    .filter(Boolean) as LookupFieldMapEntry[];
  return rows.length ? rows : undefined;
}

export function normalizeLookupDefinition(value: unknown): LookupDefinition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const normalized: LookupDefinition = {};

  const sourceType = asString(raw.sourceType) as LookupSourceType | undefined;
  if (sourceType !== undefined) normalized.sourceType = sourceType;

  const presetName = asString(raw.presetName) as LookupPresetName | undefined;
  if (presetName !== undefined) normalized.presetName = presetName;

  const dataSourceName = asString(raw.dataSourceName) as LookupDataSourceName | undefined;
  if (dataSourceName !== undefined) normalized.dataSourceName = dataSourceName;

  const apiPath = asString(raw.apiPath);
  if (apiPath !== undefined) normalized.apiPath = apiPath;

  const valueField = asString(raw.valueField);
  if (valueField !== undefined) normalized.valueField = valueField;

  const displayField = asString(raw.displayField);
  if (displayField !== undefined) normalized.displayField = displayField;

  const displayTemplate = asString(raw.displayTemplate);
  if (displayTemplate !== undefined) normalized.displayTemplate = displayTemplate;

  const placeholder = asString(raw.placeholder);
  if (placeholder !== undefined) normalized.placeholder = placeholder;

  const searchColumns = asStringArray(raw.searchColumns);
  if (searchColumns !== undefined) normalized.searchColumns = searchColumns;

  const dropdownColumns = asStringArray(raw.dropdownColumns);
  if (dropdownColumns !== undefined) normalized.dropdownColumns = dropdownColumns;

  const gridColumns = asStringArray(raw.gridColumns);
  if (gridColumns !== undefined) normalized.gridColumns = gridColumns;

  const browsable = asBoolean(raw.browsable);
  if (browsable !== undefined) normalized.browsable = browsable;

  const browseTitle = asString(raw.browseTitle);
  if (browseTitle !== undefined) normalized.browseTitle = browseTitle;

  const multiple = asBoolean(raw.multiple);
  if (multiple !== undefined) normalized.multiple = multiple;

  const checklist = asBoolean(raw.checklist);
  if (checklist !== undefined) normalized.checklist = checklist;

  const checklistHeight = asNumber(raw.checklistHeight);
  if (checklistHeight !== undefined) normalized.checklistHeight = checklistHeight;

  const checklistPageSize = asNumber(raw.checklistPageSize);
  if (checklistPageSize !== undefined) normalized.checklistPageSize = checklistPageSize;

  const preload = asBoolean(raw.preload);
  if (preload !== undefined) normalized.preload = preload;

  const readOnly = asBoolean(raw.readOnly);
  if (readOnly !== undefined) normalized.readOnly = readOnly;

  const minChars = asNumber(raw.minChars);
  if (minChars !== undefined) normalized.minChars = minChars;

  const dropdownLimit = asNumber(raw.dropdownLimit);
  if (dropdownLimit !== undefined) normalized.dropdownLimit = dropdownLimit;

  const allOptionValue = asString(raw.allOptionValue);
  if (allOptionValue !== undefined) normalized.allOptionValue = allOptionValue;

  const allOptionLabel = asString(raw.allOptionLabel);
  if (allOptionLabel !== undefined) normalized.allOptionLabel = allOptionLabel;

  const fieldMap = normalizeFieldMap(raw.fieldMap);
  if (fieldMap !== undefined) normalized.fieldMap = fieldMap;

  const handlerName = asString(raw.handlerName);
  if (handlerName !== undefined) normalized.handlerName = handlerName;

  const hydrateNonTransient = asBoolean(raw.hydrateNonTransient);
  if (hydrateNonTransient !== undefined) normalized.hydrateNonTransient = hydrateNonTransient;

  return Object.keys(normalized).length ? normalized : undefined;
}

export function serializeLookupDefinition(definition: LookupDefinition | undefined): LookupDefinition | undefined {
  return normalizeLookupDefinition(definition);
}

export function extractLookupDefinition(config: LookupConfig | undefined): LookupDefinition | undefined {
  const picked = pickSerializable(config);
  if (!picked) return undefined;
  return normalizeLookupDefinition({ sourceType: "preset", presetName: "current", ...picked });
}

function definitionToOverrides(definition: LookupDefinition): Partial<LookupConfig> {
  const overrides: Partial<LookupConfig> = {};

  if (definition.apiPath !== undefined) overrides.apiPath = definition.apiPath;
  if (definition.valueField !== undefined) overrides.valueField = definition.valueField;
  if (definition.displayField !== undefined) overrides.displayField = definition.displayField;
  if (definition.displayTemplate !== undefined) overrides.displayTemplate = definition.displayTemplate;
  if (definition.placeholder !== undefined) overrides.placeholder = definition.placeholder;
  if (definition.searchColumns !== undefined) overrides.searchColumns = definition.searchColumns;
  if (definition.dropdownColumns !== undefined) {
    overrides.dropdownColumns = definition.dropdownColumns.map(col => String(col ?? "").trim()).filter(Boolean);
  }
  if (definition.gridColumns !== undefined) {
    overrides.gridColumns = definition.gridColumns
      .map(key => String(key ?? "").trim())
      .filter(Boolean)
      .map(key => ({ key, label: toLabel(key) }));
  }
  if (definition.browsable !== undefined) overrides.browsable = definition.browsable;
  if (definition.browseTitle !== undefined) overrides.browseTitle = definition.browseTitle;
  if (definition.multiple !== undefined) overrides.multiple = definition.multiple;
  if (definition.checklist !== undefined) overrides.checklist = definition.checklist;
  if (definition.checklistHeight !== undefined) overrides.checklistHeight = definition.checklistHeight;
  if (definition.checklistPageSize !== undefined) overrides.checklistPageSize = definition.checklistPageSize;
  if (definition.preload !== undefined) overrides.preload = definition.preload;
  if (definition.readOnly !== undefined) overrides.readOnly = definition.readOnly;
  if (definition.minChars !== undefined) overrides.minChars = definition.minChars;
  if (definition.dropdownLimit !== undefined) overrides.dropdownLimit = definition.dropdownLimit;
  if (definition.allOptionValue !== undefined || definition.allOptionLabel !== undefined) {
    overrides.allOption = { value: definition.allOptionValue || "*", label: definition.allOptionLabel || "All" };
  }

  return overrides;
}

function getPresetConfig(presetName: LookupPresetName, overrides: Partial<LookupConfig>): LookupConfig | undefined {
  switch (presetName) {
    case "domain":
      return DomainLookup(overrides);
    case "group":
      return GroupLookup(overrides);
    case "active_group":
      return ActiveGroupLookup(overrides);
    case "locale":
      return LocaleLookup(overrides);
    case "user":
      return UserLookup(overrides);
    case "active_user":
      return ActiveUserLookup(overrides);
    default:
      return undefined;
  }
}

function getDataSourceConfig(dataSourceName: LookupDataSourceName, overrides: Partial<LookupConfig>): LookupConfig | undefined {
  switch (dataSourceName) {
    case "groups":
      return { dataSource: new GroupDataSource(), valueField: "group_id", displayField: "group_id", ...overrides };
    case "locales":
      return { dataSource: new LocaleDataSource(), valueField: "code", displayField: "description", ...overrides };
    case "users":
      return { dataSource: new UserDataSource(), valueField: "user_id", displayField: "full_name", ...overrides };
    case "settings":
      return { dataSource: new SettingsDataSource(), valueField: "setting_name", displayField: "setting_name", ...overrides };
    case "translations":
      return { dataSource: new TranslationDataSource(), valueField: "key", displayField: "value", ...overrides };
    case "pasoe_brokers":
      return { dataSource: new PasoeDataSource(), valueField: "name", displayField: "name", ...overrides };
    case "sso_config":
      return { dataSource: new SsoDataSource(), valueField: "provider_id", displayField: "label", ...overrides };
    default:
      return undefined;
  }
}

export function buildLookupConfig(definition: LookupDefinition | undefined, baseConfig?: LookupConfig): LookupConfig | undefined {
  const normalized = normalizeLookupDefinition(definition);
  if (!normalized) return baseConfig;

  const sourceType = normalized.sourceType
    ?? (normalized.dataSourceName ? "datasource" : normalized.apiPath ? "api" : "preset");
  const presetName = normalized.presetName ?? "current";
  const overrides = definitionToOverrides(normalized);

  if (sourceType === "preset") {
    if (presetName !== "current" && presetName !== "custom") {
      return getPresetConfig(presetName, overrides) ?? ({ ...(baseConfig ?? {}), ...overrides } as LookupConfig);
    }

    if (presetName === "custom") {
      const customConfig: LookupConfig = {
        valueField: normalized.valueField || baseConfig?.valueField || "code",
        displayField: normalized.displayField || baseConfig?.displayField || normalized.valueField || "description",
        ...overrides,
      };
      return customConfig;
    }

    return baseConfig ? { ...baseConfig, ...overrides } : undefined;
  }

  if (sourceType === "datasource" && normalized.dataSourceName) {
    return getDataSourceConfig(normalized.dataSourceName, overrides) ?? ({ ...(baseConfig ?? {}), ...overrides } as LookupConfig);
  }

  if (sourceType === "api") {
    const apiConfig: LookupConfig = {
      valueField: normalized.valueField || baseConfig?.valueField || "code",
      displayField: normalized.displayField || baseConfig?.displayField || normalized.valueField || "description",
      ...overrides,
    };
    return apiConfig;
  }

  return baseConfig ? { ...baseConfig, ...overrides } : undefined;
}
