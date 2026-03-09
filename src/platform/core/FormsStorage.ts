export const FORMS_STORAGE_KEY = "isolutions.Forms";

export interface FormsStorage {
  forms: Record<string, FormStorageNode>;
}

interface FormStorageNode {
  grids?: Record<string, GridStorageNode>;
  layouts?: Record<string, [number, number]>;
}

interface GridStorageNode {
  modes?: Record<string, GridModeStorageNode>;
}

interface GridModeStorageNode {
  columns?: unknown;
  state?: {
    version: number;
    data: unknown;
  };
}

function readStorage(): FormsStorage {
  if (typeof localStorage === "undefined") return { forms: {} };
  try {
    const raw = localStorage.getItem(FORMS_STORAGE_KEY);
    if (!raw) return { forms: {} };
    const parsed = JSON.parse(raw) as Partial<FormsStorage>;
    if (!parsed || typeof parsed !== "object") return { forms: {} };
    return { forms: parsed.forms && typeof parsed.forms === "object" ? parsed.forms : {} };
  } catch {
    return { forms: {} };
  }
}

function writeStorage(tree: FormsStorage): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(tree));
}

function ensureModeNode(
  tree: FormsStorage,
  formKey: string,
  gridKey: string,
  mode: string,
): GridModeStorageNode {
  const formNode = (tree.forms[formKey] ??= {});
  const grids = (formNode.grids ??= {});
  const gridNode = (grids[gridKey] ??= {});
  const modes = (gridNode.modes ??= {});
  return (modes[mode] ??= {});
}

export function getGridColumns(formKey: string, gridKey: string, mode: string): unknown {
  const tree = readStorage();
  return tree.forms?.[formKey]?.grids?.[gridKey]?.modes?.[mode]?.columns;
}

export function setGridColumns(formKey: string, gridKey: string, mode: string, columns: unknown): void {
  const tree = readStorage();
  const node = ensureModeNode(tree, formKey, gridKey, mode);
  node.columns = columns;
  writeStorage(tree);
}

export function getGridState(formKey: string, gridKey: string, mode: string, version: number): unknown {
  const tree = readStorage();
  const state = tree.forms?.[formKey]?.grids?.[gridKey]?.modes?.[mode]?.state;
  if (!state || typeof state !== "object") return null;
  if (state.version !== version) return null;
  return state.data;
}

export function setGridState(formKey: string, gridKey: string, mode: string, version: number, state: unknown): void {
  const tree = readStorage();
  const node = ensureModeNode(tree, formKey, gridKey, mode);
  node.state = { version, data: state };
  writeStorage(tree);
}

export function clearGridState(formKey: string, gridKey: string, mode: string): void {
  const tree = readStorage();
  const modeNode = tree.forms?.[formKey]?.grids?.[gridKey]?.modes?.[mode];
  if (!modeNode) return;
  delete modeNode.state;
  writeStorage(tree);
}

export function getLayoutSizes(formKey: string, layoutKey: string): [number, number] | null {
  const tree = readStorage();
  const sizes = tree.forms?.[formKey]?.layouts?.[layoutKey];
  if (!Array.isArray(sizes) || sizes.length !== 2) return null;
  return [Number(sizes[0]), Number(sizes[1])];
}

export function setLayoutSizes(formKey: string, layoutKey: string, sizes: [number, number]): void {
  const tree = readStorage();
  const formNode = (tree.forms[formKey] ??= {});
  const layouts = (formNode.layouts ??= {});
  layouts[layoutKey] = sizes;
  writeStorage(tree);
}
