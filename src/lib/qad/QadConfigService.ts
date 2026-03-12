import { DomainMgr } from "@/lib/qad/DomainMgr";

export interface QadConfigTableDef {
  name: string;
  customHandler?: string;
}

export interface QadConfigDatasetTableDef {
  tableName: string;
  sequence?: number;
  parentTable?: string;
  relationFields?: string;
  customHandler?: string;
}

export interface QadConfigDatasetDef {
  name: string;
  tables: QadConfigDatasetTableDef[];
}

export interface QadConfigMetadata {
  sourceFile: string;
  resolvedPath: string;
  tables: QadConfigTableDef[];
  datasets: QadConfigDatasetDef[];
}

function extractTag(block: string, tagName: string): string | undefined {
  const match = block.match(new RegExp(`<${tagName}>([\s\S]*?)<\/${tagName}>`, 'i'));
  return match ? match[1].trim() : undefined;
}

function extractAttr(block: string, attrName: string): string | undefined {
  const match = block.match(new RegExp(`${attrName}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : undefined;
}

export function parseQadConfigMetadata(xml: string, sourceFile = 'config.xml', resolvedPath = ''): QadConfigMetadata {
  const text = String(xml || '');

  const tables: QadConfigTableDef[] = [];
  const tableRegex = /<ibTable>([\s\S]*?)<\/ibTable>/gi;
  for (const match of text.matchAll(tableRegex)) {
    const block = match[1] || '';
    const name = extractTag(block, 'ibTableName');
    if (!name) continue;
    tables.push({
      name,
      customHandler: extractTag(block, 'ibCustomHandler') || undefined,
    });
  }

  const datasets: QadConfigDatasetDef[] = [];
  const datasetRegex = /<ibDataSet\s+ibDatasetName="([^"]+)"[^>]*>([\s\S]*?)<\/ibDataSet>/gi;
  for (const match of text.matchAll(datasetRegex)) {
    const name = (match[1] || '').trim();
    const body = match[2] || '';
    if (!name) continue;

    const tablesInDataset: QadConfigDatasetTableDef[] = [];
    const tableNodeRegex = /<ibDataSetTable\s+ibTableName="([^"]+)"[^>]*>([\s\S]*?)<\/ibDataSetTable>/gi;
    for (const tableMatch of body.matchAll(tableNodeRegex)) {
      const tableName = (tableMatch[1] || '').trim();
      const tableBody = tableMatch[2] || '';
      if (!tableName) continue;
      const sequenceText = extractTag(tableBody, 'ibTableSequence');
      const sequence = sequenceText && /^\d+$/.test(sequenceText) ? Number(sequenceText) : undefined;
      tablesInDataset.push({
        tableName,
        sequence,
        parentTable: extractTag(tableBody, 'ibParentTable') || undefined,
        relationFields: extractTag(tableBody, 'ibRelationFields') || undefined,
        customHandler: extractTag(tableBody, 'ibCustomHandler') || undefined,
      });
    }

    datasets.push({ name, tables: tablesInDataset });
  }

  return { sourceFile, resolvedPath, tables, datasets };
}

export class QadConfigService {
  static async load(domain: string, file = 'config.xml'): Promise<QadConfigMetadata> {
    const result = await DomainMgr.getFile({ domain, file });
    return parseQadConfigMetadata(result.content, result.file, result.path);
  }
}
