import type { PanelDef } from "./PanelDef";
import type { FieldDef } from "./FieldDef";
import type { SectionDef } from "./SectionDef";
import type { TabDef } from "./TabDef";
import { buildLookupConfig, normalizeLookupDefinition, serializeLookupDefinition, type LookupDefinition } from "./LookupDefinition";

export interface PanelLayoutRow {
  oid?: string;
  domain: string;
  form_key: string;
  panel_key: string;
  table_name: string;
  entry_type: "tab" | "section" | "field" | "custom_field" | "child_grid";
  entry_key: string;
  parent_key: string;
  sort_order: number;
  settings: Record<string, unknown>;
}

export interface PanelLayoutIdentity {
  domain: string;
  formKey: string;
  panelKey: string;
  tableName: string;
}

type RuntimePanel = PanelDef & {
  key?: string;
  panelLayoutRows?: PanelLayoutRow[];
  panelLayoutIdentity?: PanelLayoutIdentity | null;
  panelLayoutLoaded?: boolean;
  panelLayoutLoading?: Promise<void> | null;
  panelLayoutLoadError?: string | null;
  _panelLayoutBaseTabs?: TabDef[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function asOptionalMaxLength(value: unknown): number | undefined {
  const num = asOptionalNumber(value);
  return num !== undefined && num > 0 ? num : undefined;
}

function normalizeScale(value: unknown): number | null {
  const num = asOptionalNumber(value);
  return num === undefined ? null : num;
}

function normalizeMaxLength(value: unknown): number | null {
  const num = asOptionalMaxLength(value);
  return num === undefined ? null : num;
}

function normalizeRow(row: any): PanelLayoutRow | null {
  const entryType = asString(row?.entry_type) as PanelLayoutRow["entry_type"];
  if (!entryType) return null;

  return {
    oid: asString(row?.oid) || undefined,
    domain: asString(row?.domain) || "*",
    form_key: asString(row?.form_key),
    panel_key: asString(row?.panel_key),
    table_name: asString(row?.table_name),
    entry_type: entryType,
    entry_key: asString(row?.entry_key),
    parent_key: typeof row?.parent_key === "string" ? row.parent_key.trim() : "",
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : 0,
    settings: row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings) ? row.settings : {},
  };
}

export function getPanelLayoutIdentity(panel: PanelDef): PanelLayoutIdentity | null {
  const runtimePanel = panel as RuntimePanel;
  const formKey = asString((panel.form as any)?.formKey) || asString((panel.form as any)?.key);
  const panelKey = asString(runtimePanel.key) || asString(panel.grid?.key) || panel.constructor.name;
  const tableName = asString(panel.grid?.dataSource?.table);

  if (!formKey || !panelKey || !tableName) return null;

  return {
    domain: "*",
    formKey,
    panelKey,
    tableName,
  };
}

export async function ensurePanelLayoutLoaded(panel: PanelDef): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  if (runtimePanel.panelLayoutLoaded) return;
  if (runtimePanel.panelLayoutLoading) return runtimePanel.panelLayoutLoading;

  const identity = getPanelLayoutIdentity(panel);
  runtimePanel.panelLayoutIdentity = identity;
  if (!identity) {
    runtimePanel.panelLayoutRows = [];
    runtimePanel.panelLayoutLoaded = true;
    runtimePanel.panelLayoutLoadError = null;
    return;
  }

  runtimePanel.panelLayoutLoading = (async () => {
    try {
      const qs = new URLSearchParams({
        domain: identity.domain,
        form_key: identity.formKey,
        panel_key: identity.panelKey,
        table_name: identity.tableName,
      });
      const res = await fetch(`/api/panel-layout?${qs.toString()}`);
      if (!res.ok) {
        throw new Error(`Panel layout load failed (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json?.rows) ? json.rows.map(normalizeRow).filter(Boolean) as PanelLayoutRow[] : [];
      runtimePanel.panelLayoutRows = rows;
      runtimePanel.panelLayoutLoadError = null;
    } catch (err: any) {
      runtimePanel.panelLayoutRows = [];
      runtimePanel.panelLayoutLoadError = err?.message || "Failed to load panel layout";
      console.warn("PanelLayoutRuntime:", runtimePanel.panelLayoutLoadError, identity);
    } finally {
      runtimePanel.panelLayoutLoaded = true;
      runtimePanel.panelLayoutLoading = null;
    }
  })();

  return runtimePanel.panelLayoutLoading;
}


export interface FieldLayoutSettings {
  label?: string;
  hidden?: boolean;
  readOnly?: boolean;
  required?: boolean;
  renderer?: string;
  placeholder?: string;
  maxLength?: number;
  scale?: number;
  lookupDefinition?: LookupDefinition;
}

export interface SectionLayoutSettings {
  label?: string;
  hidden?: boolean;
  hideLabel?: boolean;
  columns?: number;
}

export interface TabLayoutSettings {
  label?: string;
  hidden?: boolean;
}

export interface CustomFieldDefinitionSettings {
  label: string;
  dataType: "text" | "number" | "boolean" | "date" | "datetime" | "image";
  renderer?: string;
  maxLength?: number;
  scale?: number;
  transient?: boolean;
}

type RuntimeTab = TabDef & {
  _panelLayoutBase?: {
    label: TabDef["label"];
    hidden: boolean;
    children: TabDef["children"];
  };
  _panelLayoutLabelOverride?: boolean;
};

function getTabSettings(row: PanelLayoutRow): TabLayoutSettings {
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    label: typeof settings.label === "string" ? settings.label : undefined,
    hidden: typeof settings.hidden === "boolean" ? settings.hidden : undefined,
  };
}

type RuntimeSection = SectionDef & {
  _panelLayoutBase?: {
    label: SectionDef["label"];
    hidden: boolean;
    hideLabel: boolean;
    columns: number;
    children: SectionDef["children"];
  };
  _panelLayoutLabelOverride?: boolean;
};

function getSectionSettings(row: PanelLayoutRow): SectionLayoutSettings {
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    label: typeof settings.label === "string" ? settings.label : undefined,
    hidden: typeof settings.hidden === "boolean" ? settings.hidden : undefined,
    hideLabel: typeof settings.hideLabel === "boolean" ? settings.hideLabel : undefined,
    columns: Number.isFinite(Number(settings.columns)) ? Number(settings.columns) : undefined,
  };
}

export function getSectionParentKey(panel: PanelDef, sectionKey: string): string {
  for (const tab of panel.tabs) {
    if (tab.children.some(child => child?.type === "section" && child.key === sectionKey)) {
      return tab.key || "";
    }
  }
  return "";
}

type RuntimeField = FieldDef & {
  _panelLayoutBase?: {
    label: FieldDef["label"];
    hidden: boolean;
    readOnly: boolean | undefined;
    required: boolean | undefined;
    renderer: FieldDef["renderer"];
    placeholder: FieldDef["placeholder"];
    maxLength: FieldDef["maxLength"];
    scale: FieldDef["scale"];
    lookupConfig: FieldDef["lookupConfig"];
    lookupDefinition: FieldDef["lookupDefinition"];
  };
  _panelLayoutLabelOverride?: boolean;
};

function getFieldSettings(row: PanelLayoutRow): FieldLayoutSettings {
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    label: typeof settings.label === "string" ? settings.label : undefined,
    hidden: typeof settings.hidden === "boolean" ? settings.hidden : undefined,
    readOnly: typeof settings.readOnly === "boolean" ? settings.readOnly : undefined,
    required: typeof settings.required === "boolean" ? settings.required : undefined,
    renderer: typeof settings.renderer === "string" ? settings.renderer : undefined,
    placeholder: typeof settings.placeholder === "string" ? settings.placeholder : undefined,
    maxLength: asOptionalMaxLength(settings.maxLength),
    scale: asOptionalNumber(settings.scale),
    lookupDefinition: normalizeLookupDefinition((settings as any).lookupDefinition),
  };
}

export function getFieldParentKey(panel: PanelDef, fieldKey: string): string {
  for (const tab of panel.tabs) {
    for (const child of tab.children) {
      if (child.type !== "section") continue;
      const section = child as any;
      if (Array.isArray(section.children) && section.children.some((grand: any) => grand?.type === "field" && grand.key === fieldKey)) {
        return section.key || "";
      }
    }
  }
  return "";
}

function createDynamicTab(panel: PanelDef, row: PanelLayoutRow): RuntimeTab {
  const settings = getTabSettings(row);
  const TabCtor = require("./TabDef").TabDef;
  const tab = new TabCtor({
    key: row.entry_key,
    label: settings.label || row.entry_key,
    hidden: !!settings.hidden,
    children: [],
  }) as RuntimeTab;
  tab.panel = panel;
  tab._panelLayoutBase = {
    label: tab.label,
    hidden: tab.hidden,
    children: [],
  };
  tab._panelLayoutLabelOverride = typeof settings.label === "string" && settings.label.length > 0;
  return tab;
}

function createDynamicSection(panel: PanelDef, row: PanelLayoutRow): RuntimeSection {
  const settings = getSectionSettings(row);
  const SectionCtor = require("./SectionDef").SectionDef;
  const section = new SectionCtor({
    key: row.entry_key,
    label: settings.label || row.entry_key,
    hidden: !!settings.hidden,
    hideLabel: !!settings.hideLabel,
    columns: settings.columns ?? 2,
    children: [],
  }) as RuntimeSection;
  section.panel = panel;
  section._panelLayoutBase = {
    label: section.label,
    hidden: section.hidden,
    hideLabel: section.hideLabel,
    columns: section.columns,
    children: [],
  };
  section._panelLayoutLabelOverride = typeof settings.label === "string" && settings.label.length > 0;
  return section;
}

function getBaseTabs(panel: PanelDef): TabDef[] {
  const runtimePanel = panel as RuntimePanel;
  return runtimePanel._panelLayoutBaseTabs ?? panel.tabs;
}

export function isDesignerAddedTab(panel: PanelDef, tabKey: string): boolean {
  return !getBaseTabs(panel).some(tab => tab.key === tabKey);
}

export function isDesignerAddedSection(panel: PanelDef, sectionKey: string): boolean {
  for (const tab of getBaseTabs(panel)) {
    for (const child of tab.children) {
      if (child.type === "section" && child.key === sectionKey) return false;
    }
  }
  return true;
}

export function isDesignerAddedField(panel: PanelDef, fieldKey: string): boolean {
  for (const tab of getBaseTabs(panel)) {
    for (const child of tab.children) {
      if (child.type !== "section") continue;
      const section = child as any;
      for (const grand of section.children ?? []) {
        if (grand?.type === "field" && grand.key === fieldKey) return false;
      }
    }
  }
  return true;
}

async function putPanelLayoutRows(panel: PanelDef, rows: PanelLayoutRow[]): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

function createDynamicField(panel: PanelDef, row: PanelLayoutRow): RuntimeField {
  const settings = getFieldSettings(row);
  const column = panel.grid?.dataSource?.getColumn(row.entry_key);
  const renderer = settings.renderer
    ?? (column?.renderer === "dateDisplay" ? (column?.dataType === "datetime" ? "datetime" : "date")
      : column?.renderer === "currency" ? "number"
      : column?.renderer === "badge" ? "text"
      : column?.renderer
      ?? (column?.dataType === "boolean" ? "boolean"
        : column?.dataType === "date" ? "date"
        : column?.dataType === "datetime" ? "datetime"
        : column?.dataType === "number" || column?.dataType === "decimal" ? "number"
        : "text"));
  const FieldCtor = require("./FieldDef").FieldDef;
  const field = new FieldCtor({
    key: row.entry_key,
    label: settings.label || column?.getLabel?.() || row.entry_key,
    renderer,
    hidden: !!settings.hidden,
    readOnly: settings.readOnly,
    required: settings.required,
    placeholder: settings.placeholder,
    maxLength: settings.maxLength,
    scale: settings.scale,
    lookupDefinition: settings.lookupDefinition,
    lookupConfig: buildLookupConfig(settings.lookupDefinition),
  }) as RuntimeField;
  field.panel = panel;
  field._panelLayoutBase = {
    label: field.label,
    hidden: field.hidden,
    readOnly: field.readOnly,
    required: field.required,
    renderer: field.renderer,
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    scale: field.scale,
    lookupConfig: field.lookupConfig,
    lookupDefinition: field.lookupDefinition,
  };
  field._panelLayoutLabelOverride = typeof settings.label === "string" && settings.label.length > 0;
  return field;
}

export function applyPanelLayoutToPanel(panel: PanelDef): void {
  const runtimePanel = panel as RuntimePanel;
  if (!runtimePanel._panelLayoutBaseTabs) {
    runtimePanel._panelLayoutBaseTabs = [...panel.tabs];
  }
  panel.tabs = [...runtimePanel._panelLayoutBaseTabs];

  const fieldRowMap = new Map<string, PanelLayoutRow>();
  const sectionRowMap = new Map<string, PanelLayoutRow>();
  const tabRowMap = new Map<string, PanelLayoutRow>();

  for (const row of runtimePanel.panelLayoutRows ?? []) {
    if (row.entry_type === "field") fieldRowMap.set(row.entry_key, row);
    if (row.entry_type === "section") sectionRowMap.set(row.entry_key, row);
    if (row.entry_type === "tab") tabRowMap.set(row.entry_key, row);
  }

  const existingTabKeys = new Set(panel.tabs.map(tab => tab.key));
  const dynamicTabRows = (runtimePanel.panelLayoutRows ?? [])
    .filter(row => row.entry_type === "tab" && !existingTabKeys.has(row.entry_key))
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const row of dynamicTabRows) {
    const tab = createDynamicTab(panel, row);
    panel.tabs.push(tab);
    existingTabKeys.add(tab.key);
  }

  if (tabRowMap.size) {
    const baseIndex = new Map(panel.tabs.map((tab, index) => [tab.key, index]));
    panel.tabs = [...panel.tabs].sort((a, b) => {
      const aRow = tabRowMap.get(a.key);
      const bRow = tabRowMap.get(b.key);
      const aSort = aRow?.sort_order;
      const bSort = bRow?.sort_order;
      if (aSort !== undefined && bSort !== undefined) return aSort - bSort;
      if (aSort !== undefined) return -1;
      if (bSort !== undefined) return 1;
      return (baseIndex.get(a.key) ?? 0) - (baseIndex.get(b.key) ?? 0);
    });
  }

  for (const tab of panel.tabs) {
    const runtimeTab = tab as RuntimeTab;
    if (!runtimeTab._panelLayoutBase) {
      runtimeTab._panelLayoutBase = {
        label: tab.label,
        hidden: tab.hidden,
        children: [...tab.children],
      };
    }

    const base = runtimeTab._panelLayoutBase;
    tab.label = base.label;
    tab.hidden = base.hidden;
    tab.children = [...base.children];
    runtimeTab._panelLayoutLabelOverride = false;

    const row = tabRowMap.get(tab.key);
    if (row) {
      const settings = getTabSettings(row);
      if (settings.label !== undefined) {
        tab.label = settings.label;
        runtimeTab._panelLayoutLabelOverride = true;
      }
      if (settings.hidden !== undefined) tab.hidden = settings.hidden;
    }

    const dynamicSectionRows = (runtimePanel.panelLayoutRows ?? [])
      .filter(r => r.entry_type === "section" && r.parent_key === tab.key)
      .sort((a, b) => a.sort_order - b.sort_order);
    const existingSectionKeys = new Set(tab.children.filter(c => c.type === "section").map(c => c.key));
    for (const sectionRow of dynamicSectionRows) {
      if (existingSectionKeys.has(sectionRow.entry_key)) continue;
      const section = createDynamicSection(panel, sectionRow);
      tab.children.push(section);
      existingSectionKeys.add(section.key);
    }

    if (dynamicSectionRows.length) {
      const baseIndex = new Map(tab.children.map((child, index) => [child.key, index]));
      const sortMap = new Map(dynamicSectionRows.map(row => [row.entry_key, row.sort_order]));
      tab.children = [...tab.children].sort((a, b) => {
        const aSort = sortMap.get(a.key);
        const bSort = sortMap.get(b.key);
        if (a.type === "section" && b.type === "section") {
          if (aSort !== undefined && bSort !== undefined) return aSort - bSort;
          if (aSort !== undefined) return -1;
          if (bSort !== undefined) return 1;
        }
        return (baseIndex.get(a.key) ?? 0) - (baseIndex.get(b.key) ?? 0);
      });
    }
  }

  for (const section of panel.sections) {
    const runtimeSection = section as RuntimeSection;
    if (!runtimeSection._panelLayoutBase) {
      runtimeSection._panelLayoutBase = {
        label: section.label,
        hidden: section.hidden,
        hideLabel: section.hideLabel,
        columns: section.columns,
        children: [...section.children],
      };
    }

    const base = runtimeSection._panelLayoutBase;
    section.label = base.label;
    section.hidden = base.hidden;
    section.hideLabel = base.hideLabel;
    section.columns = base.columns;
    section.children = [...base.children];
    runtimeSection._panelLayoutLabelOverride = false;

    const row = sectionRowMap.get(section.key);
    if (!row) continue;

    const settings = getSectionSettings(row);
    if (settings.label !== undefined) {
      section.label = settings.label;
      runtimeSection._panelLayoutLabelOverride = true;
    }
    if (settings.hidden !== undefined) section.hidden = settings.hidden;
    if (settings.hideLabel !== undefined) section.hideLabel = settings.hideLabel;
    if (settings.columns !== undefined) section.columns = settings.columns;

    const dynamicFieldRows = (runtimePanel.panelLayoutRows ?? [])
      .filter(r => r.entry_type === "field" && r.parent_key === section.key)
      .sort((a, b) => a.sort_order - b.sort_order);
    const existingFieldKeys = new Set(section.children.filter(c => c.type === "field").map(c => c.key));
    for (const fieldRow of dynamicFieldRows) {
      if (existingFieldKeys.has(fieldRow.entry_key)) continue;
      const field = createDynamicField(panel, fieldRow);
      section.children.push(field);
      existingFieldKeys.add(field.key);
    }

    if (dynamicFieldRows.length) {
      const baseIndex = new Map(section.children.map((child, index) => [child.key, index]));
      const sortMap = new Map(dynamicFieldRows.map(row => [row.entry_key, row.sort_order]));
      section.children = [...section.children].sort((a, b) => {
        const aSort = sortMap.get(a.key);
        const bSort = sortMap.get(b.key);
        if (aSort !== undefined && bSort !== undefined) return aSort - bSort;
        if (aSort !== undefined) return -1;
        if (bSort !== undefined) return 1;
        return (baseIndex.get(a.key) ?? 0) - (baseIndex.get(b.key) ?? 0);
      });
    }
  }

  for (const field of panel.fields) {
    const runtimeField = field as RuntimeField;
    if (!runtimeField._panelLayoutBase) {
      runtimeField._panelLayoutBase = {
        label: field.label,
        hidden: field.hidden,
        readOnly: field.readOnly,
        required: field.required,
        renderer: field.renderer,
        placeholder: field.placeholder,
        maxLength: field.maxLength,
        scale: field.scale,
        lookupConfig: field.lookupConfig,
        lookupDefinition: field.lookupDefinition,
      };
    }

    const base = runtimeField._panelLayoutBase;
    field.label = base.label;
    field.hidden = base.hidden;
    field.readOnly = base.readOnly;
    field.required = base.required;
    field.renderer = base.renderer;
    field.placeholder = base.placeholder;
    field.maxLength = base.maxLength;
    field.scale = base.scale;
    field.lookupDefinition = base.lookupDefinition;
    field.lookupConfig = buildLookupConfig(base.lookupDefinition, base.lookupConfig);
    runtimeField._panelLayoutLabelOverride = false;

    const row = fieldRowMap.get(field.key);
    if (!row) continue;

    const settings = getFieldSettings(row);
    if (settings.label !== undefined) {
      field.label = settings.label;
      runtimeField._panelLayoutLabelOverride = true;
    }
    if (settings.hidden !== undefined) field.hidden = settings.hidden;
    if (settings.readOnly !== undefined) field.readOnly = settings.readOnly;
    if (settings.required !== undefined) field.required = settings.required;
    if (settings.renderer !== undefined) field.renderer = settings.renderer as any;
    if (settings.placeholder !== undefined) field.placeholder = settings.placeholder;
    if (settings.maxLength !== undefined) field.maxLength = settings.maxLength;
    if (settings.scale !== undefined) field.scale = settings.scale;
    if (settings.lookupDefinition !== undefined) field.lookupDefinition = settings.lookupDefinition;
    field.lookupConfig = buildLookupConfig(field.lookupDefinition, base.lookupConfig);
  }
}

export function getFieldLayoutSettings(panel: PanelDef, field: FieldDef): FieldLayoutSettings {
  const runtimePanel = panel as RuntimePanel;
  const row = (runtimePanel.panelLayoutRows ?? []).find(r => r.entry_type === "field" && r.entry_key === field.key);
  return row ? getFieldSettings(row) : {};
}

export function getSectionLayoutSettings(panel: PanelDef, section: SectionDef): SectionLayoutSettings {
  const runtimePanel = panel as RuntimePanel;
  const row = (runtimePanel.panelLayoutRows ?? []).find(r => r.entry_type === "section" && r.entry_key === section.key);
  return row ? getSectionSettings(row) : {};
}

export function getTabLayoutSettings(panel: PanelDef, tab: TabDef): TabLayoutSettings {
  const runtimePanel = panel as RuntimePanel;
  const row = (runtimePanel.panelLayoutRows ?? []).find(r => r.entry_type === "tab" && r.entry_key === tab.key);
  return row ? getTabSettings(row) : {};
}

export async function addTabLayout(panel: PanelDef, settings: { key: string; label: string; hidden?: boolean; }): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const key = settings.key.trim();
  if (!key) throw new Error("Tab key is required");
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw new Error("Tab key must start with a letter and use only letters, numbers, and underscores");
  if (panel.tabs.some(tab => tab.key === key)) throw new Error(`Tab "${key}" already exists`);

  const rows = [...(runtimePanel.panelLayoutRows ?? [])];
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "tab",
    entry_key: key,
    parent_key: "",
    sort_order: rows.filter(r => r.entry_type === "tab").length * 10 + 10,
    settings: {
      label: settings.label.trim() || key,
      hidden: !!settings.hidden,
    },
  });

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}



export function isCustomField(panel: PanelDef, fieldKey: string): boolean {
  const runtimePanel = panel as RuntimePanel;
  return (runtimePanel.panelLayoutRows ?? []).some(row => row.entry_type === "custom_field" && row.entry_key === fieldKey);
}

export function getCustomFieldDefinitionSettings(panel: PanelDef, fieldKey: string): CustomFieldDefinitionSettings | null {
  const runtimePanel = panel as RuntimePanel;
  const row = (runtimePanel.panelLayoutRows ?? []).find(r => r.entry_type === "custom_field" && r.entry_key === fieldKey);
  if (!row) return null;
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    label: typeof settings.label === "string" && settings.label.trim() ? settings.label.trim() : fieldKey,
    dataType: (typeof settings.dataType === "string" && settings.dataType.trim() ? settings.dataType.trim() : "text") as any,
    renderer: typeof settings.renderer === "string" && settings.renderer.trim() ? settings.renderer.trim() : undefined,
    maxLength: asOptionalMaxLength((settings as any).maxLength),
    scale: asOptionalNumber((settings as any).scale),
    transient: (settings as any).transient === true,
  };
}

async function reloadPanelDataSourceColumns(panel: PanelDef, dropKey?: string): Promise<void> {
  const ds: any = panel.grid?.dataSource;
  if (!ds) return;
  ds._loaded = false;
  ds._loading = null;
  if (Array.isArray(ds.columns)) {
    ds.columns = dropKey ? ds.columns.filter((c: any) => c.key !== dropKey) : [];
  }
  await ds.loadColumns?.();
}

export async function addSectionLayout(panel: PanelDef, tab: TabDef, settings: { key: string; label: string; columns?: number; hideLabel?: boolean; hidden?: boolean; }): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const key = settings.key.trim();
  if (!key) throw new Error("Section key is required");
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw new Error("Section key must start with a letter and use only letters, numbers, and underscores");
  if (panel.sections.some(section => section.key === key)) throw new Error(`Section "${key}" already exists`);

  const rows = [...(runtimePanel.panelLayoutRows ?? [])];
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "section",
    entry_key: key,
    parent_key: tab.key,
    sort_order: rows.filter(r => r.entry_type === "section" && r.parent_key === tab.key).length * 10 + 10,
    settings: {
      label: settings.label.trim() || key,
      hidden: !!settings.hidden,
      hideLabel: !!settings.hideLabel,
      columns: settings.columns ?? 2,
    },
  });

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function addCustomFieldDefinition(panel: PanelDef, settings: CustomFieldDefinitionSettings & { key: string }): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const key = settings.key.trim();
  if (!key) throw new Error("Field key is required");
  if (!/^[a-z][a-z0-9_]*$/i.test(key)) throw new Error("Field key must start with a letter and use only letters, numbers, and underscores");
  if ((runtimePanel.panelLayoutRows ?? []).some(row => row.entry_type === "custom_field" && row.entry_key.toLowerCase() === key.toLowerCase())) {
    throw new Error(`Custom field "${key}" already exists`);
  }

  const rows = [...(runtimePanel.panelLayoutRows ?? [])];
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "custom_field",
    entry_key: key,
    parent_key: "",
    sort_order: rows.filter(r => r.entry_type === "custom_field").length * 10 + 10,
    settings: {
      label: settings.label.trim() || key,
      dataType: settings.dataType,
      renderer: settings.renderer || undefined,
      maxLength: normalizeMaxLength(settings.maxLength),
      scale: normalizeScale(settings.scale),
      transient: !!settings.transient,
    },
  });

  await putPanelLayoutRows(panel, rows);
  await reloadPanelDataSourceColumns(panel, key);
}

export async function saveCustomFieldDefinition(panel: PanelDef, fieldKey: string, settings: CustomFieldDefinitionSettings): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const existing = (runtimePanel.panelLayoutRows ?? []).find(row => row.entry_type === "custom_field" && row.entry_key === fieldKey);
  if (!existing) throw new Error("Custom field definition was not found");

  const rows = [...(runtimePanel.panelLayoutRows ?? [])].map(row => {
    if (!(row.entry_type === "custom_field" && row.entry_key === fieldKey)) return row;
    return {
      ...row,
      settings: {
        label: settings.label.trim() || fieldKey,
        dataType: settings.dataType,
        renderer: settings.renderer || undefined,
        maxLength: normalizeMaxLength(settings.maxLength),
        scale: normalizeScale(settings.scale),
        transient: !!settings.transient,
      },
    };
  });

  await putPanelLayoutRows(panel, rows);
  await reloadPanelDataSourceColumns(panel, fieldKey);
}

export async function removeCustomFieldDefinition(panel: PanelDef, fieldKey: string): Promise<void> {
  const identity = getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const qs = new URLSearchParams({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "custom_field",
    entry_key: fieldKey,
  });
  const res = await fetch(`/api/panel-layout?${qs.toString()}`, { method: "DELETE" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Custom field delete failed (${res.status})`);
  }

  const runtimePanel = panel as RuntimePanel;
  runtimePanel.panelLayoutRows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(
    (row.entry_type === "custom_field" && row.entry_key === fieldKey) ||
    (row.entry_type === "field" && row.entry_key === fieldKey)
  ));
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  await reloadPanelDataSourceColumns(panel, fieldKey);
  panel.refreshView();
}

export async function addFieldLayout(panel: PanelDef, section: SectionDef, settings: { key: string; label: string; renderer?: string; readOnly?: boolean; required?: boolean; hidden?: boolean; placeholder?: string; maxLength?: number; scale?: number; lookupDefinition?: LookupDefinition; }): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const key = settings.key.trim();
  if (!key) throw new Error("Field key is required");
  if (panel.fields.some(field => field.key === key)) throw new Error(`Field "${key}" already exists on this panel`);

  const rows = [...(runtimePanel.panelLayoutRows ?? [])];
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "field",
    entry_key: key,
    parent_key: section.key,
    sort_order: rows.filter(r => r.entry_type === "field" && r.parent_key === section.key).length * 10 + 10,
    settings: {
      label: settings.label.trim() || key,
      hidden: !!settings.hidden,
      readOnly: !!settings.readOnly,
      required: !!settings.required,
      renderer: settings.renderer || "text",
      placeholder: settings.placeholder || "",
      maxLength: normalizeMaxLength(settings.maxLength),
      scale: normalizeScale(settings.scale),
      lookupDefinition: serializeLookupDefinition(settings.lookupDefinition),
    },
  });

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function moveSectionLayout(panel: PanelDef, section: SectionDef, targetTabKey: string, direction?: "up" | "down"): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const sourceTabKey = getSectionParentKey(panel, section.key);
  if (!sourceTabKey) throw new Error("Section parent tab was not found");

  const tabMap = new Map(panel.tabs.map(tab => [tab.key, tab]));
  const targetTab = tabMap.get(targetTabKey);
  const sourceTab = tabMap.get(sourceTabKey);
  if (!targetTab || !sourceTab) throw new Error("Tab was not found");

  const tabSections = new Map<string, string[]>();
  for (const tab of panel.tabs) {
    tabSections.set(tab.key, tab.children.filter(child => child.type === "section").map(child => child.key));
  }

  const sourceList = [...(tabSections.get(sourceTabKey) ?? [])].filter(key => key !== section.key);
  const targetList = targetTabKey === sourceTabKey ? sourceList : [...(tabSections.get(targetTabKey) ?? [])];

  if (targetTabKey === sourceTabKey) {
    const base = tabSections.get(sourceTabKey) ?? [];
    const idx = base.indexOf(section.key);
    if (idx === -1) throw new Error("Section was not found in its tab");
    const reordered = [...base];
    if (direction === "up" && idx > 0) {
      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    } else if (direction === "down" && idx < reordered.length - 1) {
      [reordered[idx + 1], reordered[idx]] = [reordered[idx], reordered[idx + 1]];
    }
    tabSections.set(sourceTabKey, reordered);
  } else {
    targetList.push(section.key);
    tabSections.set(sourceTabKey, sourceList);
    tabSections.set(targetTabKey, targetList);
  }

  const existingSectionSettings = new Map<string, SectionLayoutSettings>();
  for (const current of panel.sections) {
    existingSectionSettings.set(current.key, getSectionLayoutSettings(panel, current));
  }

  const keepRows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => row.entry_type !== "section");
  for (const [tabKey, keys] of tabSections.entries()) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const current = panel.getSection(key);
      const settings = existingSectionSettings.get(key) ?? {};
      keepRows.push({
        domain: identity.domain,
        form_key: identity.formKey,
        panel_key: identity.panelKey,
        table_name: identity.tableName,
        entry_type: "section",
        entry_key: key,
        parent_key: tabKey,
        sort_order: (i + 1) * 10,
        settings: {
          label: settings.label ?? (typeof current.label === "string" ? current.label : current.getLabel()),
          hidden: settings.hidden ?? !!current.hidden,
          hideLabel: settings.hideLabel ?? !!current.hideLabel,
          columns: settings.columns ?? current.columns ?? 2,
        },
      });
    }
  }

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: keepRows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = keepRows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function saveSectionLayoutSettings(panel: PanelDef, section: SectionDef, settings: SectionLayoutSettings): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const rows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(row.entry_type === "section" && row.entry_key === section.key));
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "section",
    entry_key: section.key,
    parent_key: getSectionParentKey(panel, section.key),
    sort_order: rows.filter(r => r.entry_type === "section").length * 10 + 10,
    settings: {
      label: settings.label ?? "",
      hidden: !!settings.hidden,
      hideLabel: !!settings.hideLabel,
      columns: settings.columns ?? section.columns ?? 2,
    },
  });

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function saveTabLayoutSettings(panel: PanelDef, tab: TabDef, settings: TabLayoutSettings): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const rows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(row.entry_type === "tab" && row.entry_key === tab.key));
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "tab",
    entry_key: tab.key,
    parent_key: "",
    sort_order: rows.filter(r => r.entry_type === "tab").length * 10 + 10,
    settings: {
      label: settings.label ?? "",
      hidden: !!settings.hidden,
    },
  });

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function moveTabLayout(panel: PanelDef, tab: TabDef, direction: "up" | "down"): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const base = panel.tabs.map(current => current.key);
  const idx = base.indexOf(tab.key);
  if (idx === -1) throw new Error("Tab was not found");

  const reordered = [...base];
  if (direction === "up" && idx > 0) {
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
  } else if (direction === "down" && idx < reordered.length - 1) {
    [reordered[idx + 1], reordered[idx]] = [reordered[idx], reordered[idx + 1]];
  }

  const existingTabSettings = new Map<string, TabLayoutSettings>();
  for (const current of panel.tabs) {
    existingTabSettings.set(current.key, getTabLayoutSettings(panel, current));
  }

  const keepRows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => row.entry_type !== "tab");
  for (let i = 0; i < reordered.length; i++) {
    const key = reordered[i];
    const current = panel.getTab(key);
    const settings = existingTabSettings.get(key) ?? {};
    keepRows.push({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      entry_type: "tab",
      entry_key: key,
      parent_key: "",
      sort_order: (i + 1) * 10,
      settings: {
        label: settings.label ?? (typeof current.label === "string" ? current.label : current.getLabel()),
        hidden: settings.hidden ?? !!current.hidden,
      },
    });
  }

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: keepRows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = keepRows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function removeFieldLayout(panel: PanelDef, field: FieldDef): Promise<void> {
  if (!isDesignerAddedField(panel, field.key)) throw new Error("Base product fields cannot be removed yet");
  const runtimePanel = panel as RuntimePanel;
  const rows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(row.entry_type === "field" && row.entry_key === field.key));
  await putPanelLayoutRows(panel, rows);
}

export async function removeSectionLayout(panel: PanelDef, section: SectionDef): Promise<void> {
  if (!isDesignerAddedSection(panel, section.key)) throw new Error("Base product sections cannot be removed yet");
  if ((section.children ?? []).length > 0) throw new Error("Only empty sections can be removed right now");
  const runtimePanel = panel as RuntimePanel;
  const rows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(row.entry_type === "section" && row.entry_key === section.key));
  await putPanelLayoutRows(panel, rows);
}

export async function removeTabLayout(panel: PanelDef, tab: TabDef): Promise<void> {
  if (!isDesignerAddedTab(panel, tab.key)) throw new Error("Base product tabs cannot be removed yet");
  const sectionChildren = (tab.children ?? []).filter(child => child.type === "section");
  if (sectionChildren.length > 0) throw new Error("Only empty tabs can be removed right now");
  const runtimePanel = panel as RuntimePanel;
  const rows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(row.entry_type === "tab" && row.entry_key === tab.key));
  await putPanelLayoutRows(panel, rows);
}


export async function moveFieldLayout(panel: PanelDef, field: FieldDef, targetSectionKey: string, direction?: "up" | "down"): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const sourceSectionKey = getFieldParentKey(panel, field.key);
  if (!sourceSectionKey) throw new Error("Field parent section was not found");

  const sectionMap = new Map(panel.sections.map(section => [section.key, section]));
  const targetSection = sectionMap.get(targetSectionKey);
  const sourceSection = sectionMap.get(sourceSectionKey);
  if (!targetSection || !sourceSection) throw new Error("Section was not found");

  const sectionFields = new Map<string, string[]>();
  for (const section of panel.sections) {
    sectionFields.set(section.key, section.children.filter(child => child.type === "field").map(child => child.key));
  }

  const sourceList = [...(sectionFields.get(sourceSectionKey) ?? [])].filter(key => key !== field.key);
  const targetList = targetSectionKey === sourceSectionKey ? sourceList : [...(sectionFields.get(targetSectionKey) ?? [])];

  if (targetSectionKey === sourceSectionKey) {
    const base = sectionFields.get(sourceSectionKey) ?? [];
    const idx = base.indexOf(field.key);
    if (idx === -1) throw new Error("Field was not found in its section");
    const reordered = [...base];
    if (direction === "up" && idx > 0) {
      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    } else if (direction === "down" && idx < reordered.length - 1) {
      [reordered[idx + 1], reordered[idx]] = [reordered[idx], reordered[idx + 1]];
    }
    sectionFields.set(sourceSectionKey, reordered);
  } else {
    targetList.push(field.key);
    sectionFields.set(sourceSectionKey, sourceList);
    sectionFields.set(targetSectionKey, targetList);
  }

  const existingSettings = new Map<string, FieldLayoutSettings>();
  for (const current of panel.fields) {
    existingSettings.set(current.key, getFieldLayoutSettings(panel, current));
  }

  const keepRows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => row.entry_type !== "field");
  for (const [sectionKey, keys] of sectionFields.entries()) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const current = panel.getField(key);
      const settings = existingSettings.get(key) ?? {};
      keepRows.push({
        domain: identity.domain,
        form_key: identity.formKey,
        panel_key: identity.panelKey,
        table_name: identity.tableName,
        entry_type: "field",
        entry_key: key,
        parent_key: sectionKey,
        sort_order: (i + 1) * 10,
        settings: {
          label: settings.label ?? (typeof current.label === "string" ? current.label : current.getLabel()),
          hidden: settings.hidden ?? !!current.hidden,
          readOnly: settings.readOnly ?? !!current.readOnly,
          required: settings.required ?? !!current.required,
          renderer: settings.renderer ?? current.renderer ?? "text",
          placeholder: settings.placeholder ?? current.placeholder ?? "",
          maxLength: normalizeMaxLength(settings.maxLength ?? current.maxLength),
          scale: normalizeScale(settings.scale ?? current.scale),
          lookupDefinition: serializeLookupDefinition(settings.lookupDefinition ?? current.lookupDefinition),
        },
      });
    }
  }

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: keepRows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = keepRows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}

export async function saveFieldLayoutSettings(panel: PanelDef, field: FieldDef, settings: FieldLayoutSettings): Promise<void> {
  const runtimePanel = panel as RuntimePanel;
  const identity = runtimePanel.panelLayoutIdentity ?? getPanelLayoutIdentity(panel);
  if (!identity) throw new Error("Panel layout identity is not available");

  const rows = [...(runtimePanel.panelLayoutRows ?? [])].filter(row => !(row.entry_type === "field" && row.entry_key === field.key));
  rows.push({
    domain: identity.domain,
    form_key: identity.formKey,
    panel_key: identity.panelKey,
    table_name: identity.tableName,
    entry_type: "field",
    entry_key: field.key,
    parent_key: getFieldParentKey(panel, field.key),
    sort_order: rows.filter(r => r.entry_type === "field").length * 10 + 10,
    settings: {
      label: settings.label ?? "",
      hidden: !!settings.hidden,
      readOnly: !!settings.readOnly,
      required: !!settings.required,
      renderer: settings.renderer ?? field.renderer ?? "text",
      placeholder: settings.placeholder ?? field.placeholder ?? "",
      maxLength: normalizeMaxLength(settings.maxLength ?? field.maxLength),
      scale: normalizeScale(settings.scale ?? field.scale),
      lookupDefinition: serializeLookupDefinition(settings.lookupDefinition ?? field.lookupDefinition),
    },
  });

  const res = await fetch("/api/panel-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: identity.domain,
      form_key: identity.formKey,
      panel_key: identity.panelKey,
      table_name: identity.tableName,
      rows: rows.map(row => ({
        entry_type: row.entry_type,
        entry_key: row.entry_key,
        parent_key: row.parent_key,
        sort_order: row.sort_order,
        settings: row.settings,
      })),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && typeof data.error === "string" ? data.error : `Panel layout save failed (${res.status})`);
  }

  runtimePanel.panelLayoutRows = rows;
  runtimePanel.panelLayoutIdentity = identity;
  runtimePanel.panelLayoutLoaded = true;
  applyPanelLayoutToPanel(panel);
  panel.refreshView();
}
