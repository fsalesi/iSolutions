import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DomainMgr } from "@/lib/qad/DomainMgr";
import { QADProxyError } from "@/lib/qad/proxy";
import { BeSupplierService } from "@/lib/qad/services/BeSupplierService";
import { BeItemService } from "@/lib/qad/services/BeItemService";
import { BeGLService } from "@/lib/qad/services/BeGLService";
import { BeInventoryService } from "@/lib/qad/services/BeInventoryService";
import { BeInvoiceService } from "@/lib/qad/services/BeInvoiceService";
import { BePOService } from "@/lib/qad/services/BePOService";
import { BeOrderService } from "@/lib/qad/services/BeOrderService";
import { BeAddressService } from "@/lib/qad/services/BeAddressService";
import { BeGeneralService } from "@/lib/qad/services/BeGeneralService";
import { GetDataService } from "@/lib/qad/GetDataService";
import { QAD_CALL_PRESETS } from "@/lib/qad/QadCallPresets";

async function runShim(shimKey: string, domain: string, input: string, userId: string, datasetXml: string) {
  switch (shimKey) {
    case "getdata.poHeader":
    case "getdata.soHeader":
    case "getdata.customer":
    case "getdata.soLines":
    case "getdata.soWithLines": {
      let payload: any = null;
      const effectiveInput = !input.trim() && shimKey === "getdata.soWithLines"
        ? JSON.stringify({
            dsName: "dsOrder",
            whereClause: "so_domain eq 'demo1' and so_nbr eq 'SO10420'",
            fieldSet: "so_domain,so_nbr,so_cust,so_ord_date,so_stat,so_site",
            outputFormat: "json",
            numRecords: 1,
          })
        : input;
      try {
        payload = JSON.parse(effectiveInput || "{}");
      } catch {
        throw new Error(`Invalid getData JSON input: ${String(effectiveInput || "").slice(0, 240)}`);
      }
      if (!payload || typeof payload !== "object") {
        throw new Error(`Empty getData JSON input: ${String(input || "").slice(0, 240)}`);
      }
      console.log("QAD getData shim payload:", JSON.stringify({
        keys: Object.keys(payload || {}),
        dsName: payload?.dsName,
      }));
      return GetDataService.get({
        table: typeof payload?.table === "string" ? payload.table : undefined,
        dsName: typeof payload?.dsName === "string" ? payload.dsName : undefined,
        configxml: typeof payload?.configxml === "string" ? payload.configxml : undefined,
        whereClause: typeof payload?.whereClause === "string" ? payload.whereClause : undefined,
        fieldSet: payload?.fieldSet,
        outputFormat: typeof payload?.outputFormat === "string" ? payload.outputFormat : undefined,
        numRecords: typeof payload?.numRecords === "number" ? payload.numRecords : undefined,
        domain,
        userId,
        sort: typeof payload?.sort === "string" ? payload.sort : undefined,
        dir: typeof payload?.dir === "string" ? payload.dir : undefined,
        restartRowid: typeof payload?.restartRowid === "string" ? payload.restartRowid : undefined,
        rowid: typeof payload?.rowid === "string" ? payload.rowid : undefined,
        query: typeof payload?.query === "string" ? payload.query : undefined,
        queryFields: payload?.queryFields,
        filter: typeof payload?.filter === "string" ? payload.filter : undefined,
        includeSchema: !!payload?.includeSchema,
        dictdb: typeof payload?.dictdb === "string" ? payload.dictdb : undefined,
        reverse: !!payload?.reverse,
      });
    }
    case "supplier.list":
      return BeSupplierService.listSuppliers(input, domain, userId);
    case "supplier.listMatch":
      return BeSupplierService.listSuppliersMatch(input, domain, userId);
    case "supplier.get":
      return BeSupplierService.getSupplier(input, domain, userId);
    case "supplier.getBySort":
      return BeSupplierService.getSupplierBySort(input, domain, userId);
    case "item.get":
      return BeItemService.getItem(input, domain, userId);
    case "item.list":
      return BeItemService.listItems(input, domain, userId);
    case "item.getIQuote":
      return BeItemService.getItemIQuote(input, domain, userId);
    case "item.listIQuote":
      return BeItemService.listItemsIQuote(input, domain, userId);
    case "item.productLines":
      return BeItemService.listProductLines(domain, userId);
    case "item.planning":
      return BeItemService.listItemPlanningRecords(input, domain, userId);
    case "item.getCost":
      return BeItemService.getCostXml(datasetXml, domain, userId);
    case "item.getTotalCost":
      return BeItemService.getTotalCostXml(datasetXml, domain, userId);
    case "item.getCostIQuote":
      return BeItemService.getCostIQuoteXml(datasetXml, domain, userId);
    case "item.getDetails":
      return BeItemService.getItemDetailsXml(datasetXml, domain, userId);
    case "address.get":
      return BeAddressService.getAddress(input, domain, userId);
    case "address.getByRowid":
      return BeAddressService.getAddressByRowid(input, domain, userId);
    case "address.list": {
      let payload: { query?: string; exclude?: string } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeAddressService.listAddresses(
        typeof payload?.query === "string" ? payload.query : input,
        typeof payload?.exclude === "string" ? payload.exclude : "",
        domain,
        userId,
      );
    }
    case "address.listByType":
      return BeAddressService.listAddressesByType(input, domain, userId);
    case "gl.getAccount":
      return BeGLService.getAccount(input, "", domain, userId);
    case "gl.listAccountsForDept":
      return BeGLService.listAccountsForDept(input, "", "", "", domain, userId);
    case "gl.getSubAccount":
      return BeGLService.getSubAccount(input, "", domain, userId);
    case "gl.listSubAccountsForDept": {
      let dept = "";
      let account = "";
      try {
        const parsed = JSON.parse(input || "{}");
        if (parsed && typeof parsed === "object") {
          dept = typeof parsed.dept === "string" ? parsed.dept : "";
          account = typeof parsed.account === "string" ? parsed.account : "";
        }
      } catch {
        const parts = input.split("|");
        dept = parts[0] || "";
        account = parts[1] || "";
      }
      return BeGLService.listSubAccountsForDept(dept, "", "", "", account, domain, userId);
    }
    case "gl.getDept":
      return BeGLService.getDept(input, "", domain, userId);
    case "gl.listActiveDepts":
      return BeGLService.listActiveDepts("", "", "", domain, userId);
    case "gl.listDepts":
      return BeGLService.listDepts(input, "", "", "", domain, userId);
    case "gl.listAllDepts":
      return BeGLService.listAllDepts("", "", "", domain, userId);
    case "gl.getProject":
      return BeGLService.getProject(input, domain, userId);
    case "gl.listProjects": {
      let search: { dept?: string; account?: string; query?: string } | string = input;
      try {
        const parsed = JSON.parse(input || "{}");
        if (parsed && typeof parsed === "object") {
          search = {
            dept: typeof parsed.dept === "string" ? parsed.dept : "",
            account: typeof parsed.account === "string" ? parsed.account : "",
            query: typeof parsed.query === "string" ? parsed.query : "",
          };
        }
      } catch {
        search = input;
      }
      return BeGLService.listProjects(search, domain, userId);
    }
    case "gl.allocationCodes":
      return BeGLService.getAllocationCodes(domain, userId);
    case "gl.isValidSubAccount": {
      let payload: { subAccount?: string; account?: string; budgetCode?: string; reqType?: string; site?: string } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeGLService.isValidSubAccount(
        typeof payload?.subAccount === "string" ? payload.subAccount : "",
        typeof payload?.account === "string" ? payload.account : "",
        typeof payload?.budgetCode === "string" ? payload.budgetCode : "",
        typeof payload?.reqType === "string" ? payload.reqType : "",
        typeof payload?.site === "string" ? payload.site : "",
        domain,
        userId,
      );
    }
    case "gl.isValidSubAccountTT": {
      let payload: { rows?: Array<{ subAccount?: string; account?: string }>; budgetCode?: string; reqType?: string; site?: string } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      const rows = Array.isArray(payload?.rows) ? payload.rows.map(row => ({
        subAccount: typeof row?.subAccount === "string" ? row.subAccount : "",
        account: typeof row?.account === "string" ? row.account : "",
      })) : [];
      return BeGLService.isValidSubAccountTT(
        rows,
        typeof payload?.budgetCode === "string" ? payload.budgetCode : "",
        typeof payload?.reqType === "string" ? payload.reqType : "",
        typeof payload?.site === "string" ? payload.site : "",
        domain,
        userId,
      );
    }
    case "gl.isValidAccount": {
      let payload: { account?: string; subAccount?: string; dept?: string; project?: string; budgetCode?: string; reqType?: string; site?: string } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeGLService.isValidAccount(
        typeof payload?.account === "string" ? payload.account : "",
        typeof payload?.subAccount === "string" ? payload.subAccount : "",
        typeof payload?.dept === "string" ? payload.dept : "",
        typeof payload?.project === "string" ? payload.project : "",
        typeof payload?.budgetCode === "string" ? payload.budgetCode : "",
        typeof payload?.reqType === "string" ? payload.reqType : "",
        typeof payload?.site === "string" ? payload.site : "",
        domain,
        userId,
      );
    }
    case "general.getLastTRNbr":
      return BeGeneralService.getLastTRNbr(domain, userId);
    case "general.getLatestTransactionHistory": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeGeneralService.getLatestTransactionHistory(
        typeof payload?.typeList === "string" ? payload.typeList : "",
        typeof payload?.start === "number" ? payload.start : Number(payload?.start || 0),
        typeof payload?.lastDate === "string" ? payload.lastDate : "",
        !!payload?.minResults,
        domain,
        userId,
      );
    }
    case "general.getCreditTerms":
      return BeGeneralService.getCreditTerms(input, domain, userId);
    case "general.listCreditTerms":
      return BeGeneralService.listCreditTerms(domain, userId);
    case "general.getSalesPerson":
      return BeGeneralService.getSalesPerson(input, domain, userId);
    case "general.listSalesPersons":
      return BeGeneralService.listSalesPersons(domain, userId);
    case "general.getTrailerCode":
      return BeGeneralService.getTrailerCode(input, domain, userId);
    case "general.listTrailerCodes":
      return BeGeneralService.listTrailerCodes(domain, userId);
    case "general.listCountryCodes":
      return BeGeneralService.listCountryCodes(domain, userId);
    case "general.getWorkDays": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeGeneralService.getWorkDays(
        typeof payload?.site === "string" ? payload.site : "",
        typeof payload?.address === "string" ? payload.address : "",
        typeof payload?.date === "string" ? payload.date : "",
        typeof payload?.days === "number" ? payload.days : Number(payload?.days || 0),
        domain,
        userId,
      );
    }
    case "inventory.getUnplannedIssueStructure":
      return BeInventoryService.getUnplannedIssueStructure(domain, userId);
    case "inventory.unplannedIssue":
      return BeInventoryService.unplannedIssue(datasetXml, domain, userId);
    case "inventory.getTransferStructure":
      return BeInventoryService.getInventoryTransferStructure(domain, userId);
    case "inventory.transfer":
      return BeInventoryService.transferInventory(datasetXml, domain, userId);
    case "inventory.getLocInfo": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeInventoryService.getLocInfo(
        typeof payload?.item === "string" ? payload.item : "",
        typeof payload?.site === "string" ? payload.site : "",
        typeof payload?.location === "string" ? payload.location : "",
        typeof payload?.lot === "string" ? payload.lot : "",
        typeof payload?.ref === "string" ? payload.ref : "",
        domain,
        userId,
      );
    }
    case "inventory.getLots": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeInventoryService.getLots(
        typeof payload?.item === "string" ? payload.item : "",
        typeof payload?.site === "string" ? payload.site : "",
        typeof payload?.lot === "string" ? payload.lot : "",
        typeof payload?.ref === "string" ? payload.ref : "",
        domain,
        userId,
      );
    }
    case "inventory.getLocStatus": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeInventoryService.getLocStatus(
        typeof payload?.site === "string" ? payload.site : "",
        typeof payload?.location === "string" ? payload.location : "",
        domain,
        userId,
      );
    }
    case "invoice.get":
      return BeInvoiceService.getInvoice(input, domain, userId);
    case "invoice.getByRowid":
      return BeInvoiceService.getInvoiceByRowid(input, domain, userId);
    case "invoice.createPending":
      return BeInvoiceService.createPendingInvoice(datasetXml, domain, userId);
    case "invoice.setOrderTypes": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      const rows = Array.isArray(payload?.rows) ? payload.rows.map((row: any) => ({
        site: typeof row?.site === "string" ? row.site : "",
        location: typeof row?.location === "string" ? row.location : "",
        part: typeof row?.part === "string" ? row.part : "",
        lot: typeof row?.lot === "string" ? row.lot : "",
        ref: typeof row?.ref === "string" ? row.ref : "",
        type: typeof row?.type === "string" ? row.type : "",
        customer: typeof row?.customer === "string" ? row.customer : "",
      })) : [];
      return BeInvoiceService.setOrderTypes(rows, domain, userId);
    }
    case "order.get":
      return BeOrderService.getOrder(input, domain, userId);
    case "order.getByRowid":
      return BeOrderService.getOrderByRowid(input, domain, userId);
    case "order.listByCustomer":
      return BeOrderService.listOrdersByCustomer(input, domain, userId);
    case "order.linesByRowids":
      return BeOrderService.listLinesByRowids(input, domain, userId);
    case "order.clearEMT": {
      let payload: { orderNumber?: string; line?: number } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BeOrderService.clearEMT(
        typeof payload?.orderNumber === "string" ? payload.orderNumber : "",
        typeof payload?.line === "number" ? payload.line : Number(payload?.line || 0),
        domain,
        userId,
      );
    }
    case "order.getNextNumber":
      return BeOrderService.getNextSONumber(domain, userId);
    case "po.getInvoicedQty": {
      let payload: { poNumber?: string; line?: number } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BePOService.getInvoicedQty(
        typeof payload?.poNumber === "string" ? payload.poNumber : "",
        typeof payload?.line === "number" ? payload.line : Number(payload?.line || 0),
        domain,
        userId,
      );
    }
    case "po.getPO":
      return BePOService.getPO(input, domain, userId);
    case "po.getPOLine": {
      let poNumber = "";
      let line = 1;
      try {
        const payload = JSON.parse(input || "{}");
        if (payload && typeof payload === "object") {
          poNumber = typeof payload.poNumber === "string" ? payload.poNumber : "";
          line = typeof payload.line === "number" ? payload.line : Number(payload.line || 1);
        }
      } catch {
        if (input.includes("|")) {
          const parts = input.split("|");
          poNumber = parts[0] || "";
          line = Number(parts[1] || 1);
        } else {
          poNumber = input.trim();
        }
      }
      return BePOService.getPOLine(poNumber, line, domain, userId);
    }
    case "po.getTRHistReceipts":
      return BePOService.getTRHistReceipts(Number(input || 0), domain, userId);
    case "po.getReceipts":
      return BePOService.getPOReceipts(input, domain, userId);
    case "po.getStatus":
      return BePOService.getPOStatus(input, domain, userId);
    case "po.getNextNumber":
      return BePOService.getNextPONumber(domain, userId);
    case "po.getNextNumberCustom": {
      let payload: { prefix?: string; lastNumber?: number } | null = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BePOService.getNextPONumberCustom(
        typeof payload?.prefix === "string" ? payload.prefix : "",
        typeof payload?.lastNumber === "number" ? payload.lastNumber : Number(payload?.lastNumber || 0),
        domain,
        userId,
      );
    }
    case "po.openByItem": {
      let payload: any = null;
      try { payload = JSON.parse(input || "{}"); } catch {}
      return BePOService.getOpenPOByItem(payload && typeof payload === "object" ? payload : input, domain, userId);
    }
    case "po.getCreateStructure":
      return BePOService.getCreatePOStructure(domain, userId);
    case "po.create":
      return BePOService.createPO(datasetXml, domain, userId);
    case "po.receive":
      return BePOService.receivePO(datasetXml, domain, userId);
    case "po.printOpen":
      return BePOService.printOpenPO(input, domain, userId);
    case "supplier.email":
      return BeSupplierService.getSupplierEmail(input, domain, userId);
    default:
      return null;
  }
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const procedure = String(body.procedure ?? "").trim();
  const entry = String(body.entry ?? "").trim();
  const input = String(body.input ?? "");
  const longchar = String(body.longchar ?? "");
  const datasetXml = String(body.datasetXml ?? body.longchar ?? "");
  const domain = String(body.domain ?? "").trim();
  const requestedShimKey = String(body.shimKey ?? "").trim();
  const inferredShimKey = QAD_CALL_PRESETS.find((preset) => preset.procedure === procedure && preset.entry === entry)?.key || "";
  const shimKey = requestedShimKey || inferredShimKey;

  if (!procedure) {
    return NextResponse.json({ error: "procedure is required" }, { status: 400 });
  }
  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  try {
    if (procedure === "beinvoice.p" && entry === "beGetInvoiceByRowid") {
      const raw = await DomainMgr.call({ procedure, entry, input, domain, userId, datasetMode: "typed" });
      const mapped = await BeInvoiceService.getInvoiceByRowid(input, domain, userId);
      return NextResponse.json({ ok: true, result: mapped, raw, mode: "shim-direct", resultType: typeof mapped, shimKey: "invoice.getByRowid" });
    }

    if (shimKey) {
      const shimResult = await runShim(shimKey, domain, input, userId, datasetXml);
      if (shimResult === null) {
        return NextResponse.json({ error: `No shim handler found for ` }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result: shimResult, mode: "shim", resultType: typeof shimResult, shimKey });
    }

    const result = await DomainMgr.call({
      procedure,
      entry,
      input,
      longchar: longchar || undefined,
      domain,
      userId,
    });
    return NextResponse.json({ ok: true, result, mode: "raw" });
  } catch (err) {
    if (err instanceof QADProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("QAD call test error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
