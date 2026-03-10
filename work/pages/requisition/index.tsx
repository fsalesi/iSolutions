import type { ToolbarButtonClickContext } from "@/platform/core/ToolbarDef";
import { RequisitionPage as ProductRequisitionPage } from "@/page-defs/requisition";
import {
  requisitionToolbarButtonHandlerOptions,
  requisitionToolbarButtonHandlers,
} from "./components";

export class RequisitionPage extends ProductRequisitionPage {
  readonly toolbarButtonHandlerOptions = requisitionToolbarButtonHandlerOptions;

  sayHello(context?: ToolbarButtonClickContext): void {
    void context;
    requisitionToolbarButtonHandlers.sayHello.call(this, {} as ToolbarButtonClickContext);
  }

  showCurrentRecord(context: ToolbarButtonClickContext): void {
    requisitionToolbarButtonHandlers.showCurrentRecord.call(this, context);
  }
}
