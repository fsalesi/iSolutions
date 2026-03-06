/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
/* FormPage shared types */

export interface LayoutEntry {
  oid: string;
  domain: string;
  form_key: string;
  layout_type: string;
  layout_key: string;
  table_name: string;
  parent_key: string;
  sort_order: number;
  properties: Record<string, any>;
}

export interface FormStructure {
  tables: TableInfo[];
  headerTable: string;
}

export interface TableInfo {
  table_name: string;
  is_header: boolean;
  parent_table: string;
  tab_label: string;
  sort_order: number;
}

export interface FormField {
  field_name: string;
  data_type: string;
  table_name: string;
  is_nullable: boolean;
  scale?: number;
}

export interface FormMeta {
  tables: TableInfo[];
  headerTable: string;
  layout: LayoutEntry[];
  colTypes: Record<string, string>;
  colScales: Record<string, number>;
  fields: FormField[];
}

export type Row = Record<string, any> & { oid: string };
