// types.ts — Shared types for the iSolutions Form Platform v2

export type Row = Record<string, any>;

export interface SelectOption {
  value: string;
  label: string;
}

export interface RowAttrs {
  className?: string;
  style?: Record<string, string>;
  [dataAttr: string]: any;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  status: number;
}


export interface FetchParams {
  search?: string;
  whereClause?: string;
  globalWhereClause?: string;
  filter?: any; // FilterTree — see components/grid/filter/filter-types.ts
  sort?: string[];
  sortDirection?: ("ASC" | "DESC")[];
  page?: number;
  pageSize?: number;
  fields?: string[];
  parentRow?: Row | null;
  format?: "json" | "xlsx";
}

export type RendererType =
  // Field renderers
  | "text" | "number" | "date" | "datetime" | "checkbox"
  | "select" | "lookup" | "textarea" | "password" | "readonly" | "image"
  // Column renderers
  | "badge" | "currency" | "boolean" | "dateDisplay";

export type DisplayMode = "inline" | "slide-in-right" | "modal-centered";

export type GridMode = "browse" | "inquiry" | "lookup";
