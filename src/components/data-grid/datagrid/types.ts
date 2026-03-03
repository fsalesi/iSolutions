import type { ReactNode } from "react";
import type { ColType } from "../AdvancedSearch";

export type ColumnDef<T> = {
  key: keyof T & string;
  label?: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  width?: string;
  hideOnMobile?: boolean;
  /** If true, column cannot be hidden */
  locked?: boolean;
  /** If true, column is excluded from the grid entirely */
  hidden?: boolean;
};

export type SortState = {
  field: string;
  dir: "asc" | "desc";
};

export type PageResult<T> = {
  rows: T[];
  total: number;
  offset: number;
  limit: number;
  requiredFields?: string[];
};

export type FetchPage<T> = (params: {
  offset: number;
  limit: number;
  search: string;
  sort: string;
  dir: "asc" | "desc";
  filters?: string;
}) => Promise<PageResult<T>>;

export type { ColType };
