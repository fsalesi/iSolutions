// EditPanel.tsx — Standard CRUD edit panel.
// Extends PanelDef with Renderable so it can be dropped into any layout node.
// Subclass this for every edit panel in the system.

import { PanelDef } from "./PanelDef";
import type { Renderable } from "./LayoutNode";

export interface EditPanelOptions {
  readOnly?:  boolean;
  useNew?:    boolean;
  useSave?:   boolean;
  useDelete?: boolean;
  useCopy?:   boolean;
  useNotes?:  boolean;
  useAudit?:  boolean;
  usePrint?:  boolean;
}

export class EditPanel extends PanelDef implements Renderable {
  constructor(options: EditPanelOptions = {}, form?: any) {
    super(form);
    if (options.readOnly  !== undefined) this.readOnly             = options.readOnly;
    if (options.useNew    !== undefined) this.toolbar.useNew       = options.useNew;
    if (options.useSave   !== undefined) this.toolbar.useSave      = options.useSave;
    if (options.useDelete !== undefined) this.toolbar.useDelete    = options.useDelete;
    if (options.useCopy   !== undefined) this.toolbar.useCopy      = options.useCopy;
    if (options.useNotes  !== undefined) this.toolbar.useNotes     = options.useNotes;
    if (options.useAudit  !== undefined) this.toolbar.useAudit     = options.useAudit;
    if (options.usePrint  !== undefined) this.toolbar.usePrint     = options.usePrint;
  }

  render(): import("react").ReactNode {
    const { EditPanelRenderer } = require("@/components/panel/EditPanelRenderer");
    const renderKey = `${this.form?.key ?? "form"}:${this.constructor.name}`;
    return <EditPanelRenderer key={renderKey} panel={this} />;
  }
}
