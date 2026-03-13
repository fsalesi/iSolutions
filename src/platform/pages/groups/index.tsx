import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { GroupGrid } from "./GroupGrid";
import { GroupEditPanel } from "./GroupEditPanel";
import ExcelJS from "exceljs";
import { AlertDialogService } from "@/platform/core/AlertDialogService";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";

export class GroupsPage extends PageDef {
  readonly title   = "Groups";
  readonly formKey = "groups";

  protected grid      = new GroupGrid(this);
  protected editPanel = new GroupEditPanel(this);
  protected layout    = new HorizontalLayout("groups", {
    sizes:    [40, 60],
    minSizes: [200, 300],
  });

  constructor() {
    super();
    this.grid.panel     = this.editPanel;
    this.editPanel.grid = this.grid;
    this.layout.left.content  = this.grid;
    this.layout.right.content = this.editPanel;

    this.editPanel.toolbar.addButton({
      key:   "export",
      label: tx("groups.actions.export", "Export"),
      icon:  "download",
      onClick: () => this.exportToExcel(),
    });
  }

  private async exportToExcel(): Promise<void> {
    try {
      const res  = await fetch("/api/groups/export");
      const data = await res.json() as { rows?: Record<string, string>[]; error?: string };

      if (data.error) { await AlertDialogService.error(data.error); return; }

      const rows = data.rows ?? [];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Groups");

      ws.columns = [
        { header: "Group Code", key: "group_id",    width: 20 },
        { header: "Name",       key: "description", width: 30 },
        { header: "User ID",    key: "user_id",     width: 20 },
        { header: "Full Name",  key: "full_name",   width: 30 },
        { header: "Title",      key: "title",       width: 30 },
      ];

      // Bold header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.commit();

      rows.forEach(r => ws.addRow(r));

      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = "groups-members.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      await AlertDialogService.error(resolveClientText(tx("groups.messages.export_failed", "Export failed: {error}"), { error: String(err) }));
    }
  }
}
