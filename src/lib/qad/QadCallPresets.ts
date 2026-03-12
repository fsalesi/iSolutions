export interface QadCallPreset {
  key: string;
  label: string;
  description?: string;
  procedure: string;
  entry: string;
  sampleInput?: string;
  sampleLongchar?: string;
}

export const QAD_CALL_PRESETS: QadCallPreset[] = [
  {
    key: "getdata.poHeader",
    label: "GetData PO Header",
    description: "Generic getData single-table query for PO header. Always filter by domain.",
    procedure: "getData.p",
    entry: "singleTable",
    sampleInput: `{
  "table": "po_mstr",
  "whereClause": "po_domain eq 'demo1' and po_nbr eq 'D133636'",
  "fieldSet": ["po_domain", "po_nbr", "po_vend", "po_buyer", "po_ord_date", "po_ship"],
  "numRecords": 1
}`,
  },
  {
    key: "getdata.soHeader",
    label: "GetData SO Header",
    description: "Generic getData single-table query for sales order header. Always filter by domain.",
    procedure: "getData.p",
    entry: "singleTable",
    sampleInput: `{
  "table": "so_mstr",
  "whereClause": "so_domain eq 'demo1' and so_nbr eq 'SO10420'",
  "fieldSet": ["so_domain", "so_nbr", "so_cust", "so_ord_date", "so_stat", "so_site"],
  "numRecords": 1
}`,
  },
  {
    key: "getdata.customer",
    label: "GetData Customer",
    description: "Generic getData single-table query for customer. Always filter by domain.",
    procedure: "getData.p",
    entry: "singleTable",
    sampleInput: `{
  "table": "cm_mstr",
  "whereClause": "cm_domain eq 'demo1' and cm_addr eq '01000000'",
  "fieldSet": ["cm_domain", "cm_addr", "cm_sort", "cm_curr", "cm_cr_terms"],
  "numRecords": 1
}`,
  },
  {
    key: "getdata.soLines",
    label: "GetData SO Lines",
    description: "Generic getData single-table query for order lines. Always filter by domain and order number.",
    procedure: "getData.p",
    entry: "singleTable",
    sampleInput: `{
  "table": "sod_det",
  "whereClause": "sod_domain eq 'demo1' and sod_nbr eq 'SO10420'",
  "fieldSet": ["sod_domain", "sod_nbr", "sod_line", "sod_part", "sod_qty_ord", "sod_price"],
  "sort": "sod_line",
  "dir": "asc",
  "numRecords": 50
}`,
  },
  {
    key: "getdata.soWithLines",
    label: "GetData SO With Lines",
    description: "Generic getData query using a predefined dataset from config.xml. The dataset name `dsOrder` must exist in config.xml before this example will work. Always filter by domain.",
    procedure: "getData.p",
    entry: "dataset",
    sampleInput: JSON.stringify({
      dsName: "dsOrder",
      whereClause: "so_domain eq 'demo1' and so_nbr eq 'SO10420'",
      fieldSet: "so_domain,so_nbr,so_cust,so_ord_date,so_stat,so_site",
      outputFormat: "json",
      numRecords: 1
    }, null, 2),
  },
  {
    key: "supplier.list",
    label: "BeSupplier.listSuppliers",
    description: "Search suppliers by sort/name prefix.",
    procedure: "besupplier.p",
    entry: "beListSuppliers",
    sampleInput: "CDW",
  },
  {
    key: "supplier.listMatch",
    label: "BeSupplier.listSuppliersMatch",
    description: "Search suppliers using contains-match behavior.",
    procedure: "besupplier.p",
    entry: "beListSuppliersMatch",
    sampleInput: "CDW",
  },
  {
    key: "supplier.get",
    label: "BeSupplier.getSupplier",
    description: "Get a single supplier by vendor code.",
    procedure: "besupplier.p",
    entry: "beGetSupplier",
    sampleInput: "5004000",
  },
  {
    key: "supplier.getBySort",
    label: "BeSupplier.getSupplierBySort",
    description: "Get a single supplier by sort/display name.",
    procedure: "besupplier.p",
    entry: "beGetSupplierBySort",
    sampleInput: "CDW",
  },
  {
    key: "item.get",
    label: "BeItem.getItem",
    description: "Get a single item by item number.",
    procedure: "beitem.p",
    entry: "beGetItem",
    sampleInput: "22-110",
  },
  {
    key: "item.list",
    label: "BeItem.listItems",
    description: "Search items by part number or description prefix.",
    procedure: "beitem.p",
    entry: "beListItems",
    sampleInput: "22-",
  },
  {
    key: "item.getIQuote",
    label: "BeItem.getItemIQuote",
    description: "Get a single item for iQuote.",
    procedure: "beitem.p",
    entry: "beGetItemIQuote",
    sampleInput: "22-110",
  },
  {
    key: "item.listIQuote",
    label: "BeItem.listItemsIQuote",
    description: "Search items for iQuote.",
    procedure: "beitem.p",
    entry: "beListItemsIQuote",
    sampleInput: "22-",
  },
  {
    key: "item.productLines",
    label: "BeItem.listProductLines",
    description: "List QAD product lines.",
    procedure: "beitem.p",
    entry: "beListProductLines",
    sampleInput: "",
  },
  {
    key: "item.planning",
    label: "BeItem.listItemPlanningRecords",
    description: "List planning records for an item.",
    procedure: "beitem.p",
    entry: "beListItemPlanningRecords",
    sampleInput: "22-110",
  },
  {
    key: "item.getCost",
    label: "BeItem.getCost",
    description: "Calculate item cost using dsItemCost input rows.",
    procedure: "beitem.p",
    entry: "beGetCost",
    sampleInput: "",
    sampleLongchar: `<?xml version="1.0"?>
<dsItemCost xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ttItemCost>
    <Vendor>5004000</Vendor>
    <Item>22-110</Item>
    <Site>10000</Site>
    <UOM>EA</UOM>
    <Currency>usd</Currency>
    <Qty>1.00000</Qty>
    <UnitCost>0.00000</UnitCost>
    <CurrCost>0.00000</CurrCost>
    <StockUOM/>
    <StockQty>0.0000000000</StockQty>
  </ttItemCost>
</dsItemCost>`,
  },
  {
    key: "item.getTotalCost",
    label: "BeItem.getTotalCost",
    description: "Calculate total item cost using dsItemCost input rows.",
    procedure: "beitem.p",
    entry: "beGetTotalCost",
    sampleInput: "",
    sampleLongchar: `<?xml version="1.0"?>
<dsItemCost xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ttItemCost>
    <Vendor>5004000</Vendor>
    <Item>22-110</Item>
    <Site>10000</Site>
    <UOM>EA</UOM>
    <Currency>usd</Currency>
    <Qty>1.00000</Qty>
    <UnitCost>0.00000</UnitCost>
    <CurrCost>0.00000</CurrCost>
    <StockUOM/>
    <StockQty>0.0000000000</StockQty>
  </ttItemCost>
</dsItemCost>`,
  },
  {
    key: "item.getCostIQuote",
    label: "BeItem.getCostIQuote",
    description: "Calculate iQuote item cost using dsItemCost input rows.",
    procedure: "beitem.p",
    entry: "beGetCostIQuote",
    sampleInput: "",
    sampleLongchar: `<?xml version="1.0"?>
<dsItemCost xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ttItemCost>
    <Vendor>5004000</Vendor>
    <Item>22-110</Item>
    <Site>10000</Site>
    <UOM>EA</UOM>
    <Currency>usd</Currency>
    <Qty>1.00000</Qty>
    <UnitCost>0.00000</UnitCost>
    <CurrCost>0.00000</CurrCost>
    <StockUOM/>
    <StockQty>0.0000000000</StockQty>
  </ttItemCost>
</dsItemCost>`,
  },
  {
    key: "item.getDetails",
    label: "BeItem.getItemDetails",
    description: "Populate dsItemDetails rows.",
    procedure: "beitem.p",
    entry: "beGetItemDetails",
    sampleInput: "",
    sampleLongchar: `<?xml version="1.0"?>
<dsItemDetails xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ttItemDetails>
    <EffectiveDate>2026-03-11</EffectiveDate>
    <Item>22-110</Item>
    <SiteId>10000</SiteId>
    <InspectionLocationId></InspectionLocationId>
    <SupplierType></SupplierType>
    <StandardCost>0.00000</StandardCost>
    <Revision></Revision>
    <LocationId></LocationId>
    <InspectionRequired>false</InspectionRequired>
    <PurchaseAccount></PurchaseAccount>
    <PurchaseSubAccount></PurchaseSubAccount>
    <PurchaseCostCenter></PurchaseCostCenter>
    <ItemType></ItemType>
  </ttItemDetails>
</dsItemDetails>`,
  },
  {
    key: "address.get",
    label: "BeAddress.getAddress",
    description: "Get a single address by address number.",
    procedure: "beaddress.p",
    entry: "beGetAddressByNumber",
    sampleInput: "5004000",
  },
  {
    key: "address.getByRowid",
    label: "BeAddress.getAddressByRowid",
    description: "Get a single address by rowid string.",
    procedure: "beaddress.p",
    entry: "beGetAddressByRowid",
    sampleInput: "",
  },
  {
    key: "address.list",
    label: "BeAddress.listAddresses",
    description: "Search addresses by number or sort/name prefix.",
    procedure: "beaddress.p",
    entry: "beListAddresses",
    sampleInput: `{
  "query": "CDW",
  "exclude": ""
}`,
  },
  {
    key: "address.listByType",
    label: "BeAddress.listAddressesByType",
    description: "List addresses by ls_type prefix.",
    procedure: "beaddress.p",
    entry: "beListAddressesByType",
    sampleInput: "",
  },
  {
    key: "gl.getAccount",
    label: "BeGL.getAccount",
    description: "Get a single GL account.",
    procedure: "beglacct.p",
    entry: "beGetAccount",
    sampleInput: "8200",
  },
  {
    key: "gl.listAccountsForDept",
    label: "BeGL.listAccountsForDept",
    description: "List GL accounts for a department/cost center.",
    procedure: "beglacct.p",
    entry: "beListAccountsForDept",
    sampleInput: "2000",
  },
  {
    key: "gl.getSubAccount",
    label: "BeGL.getSubAccount",
    description: "Get a single GL sub account.",
    procedure: "beglacct.p",
    entry: "beGetSubAccount",
    sampleInput: "1000",
  },
  {
    key: "gl.listSubAccountsForDept",
    label: "BeGL.listSubAccountsForDept",
    description: "List sub accounts by structured dept/account input.",
    procedure: "beglacct.p",
    entry: "beListSubAccountsForDept",
    sampleInput: `{
  "dept": "2000",
  "account": "8200"
}`,
  },
  {
    key: "gl.getDept",
    label: "BeGL.getDept",
    description: "Get a single department/cost center.",
    procedure: "beglacct.p",
    entry: "beGetDept",
    sampleInput: "2000",
  },
  {
    key: "gl.listActiveDepts",
    label: "BeGL.listActiveDepts",
    description: "List active departments.",
    procedure: "beglacct.p",
    entry: "beListActiveDept",
    sampleInput: "",
  },
  {
    key: "gl.listDepts",
    label: "BeGL.listDepts",
    description: "Search departments by code prefix.",
    procedure: "beglacct.p",
    entry: "beListDepts",
    sampleInput: "2000",
  },
  {
    key: "gl.listAllDepts",
    label: "BeGL.listAllDepts",
    description: "List all departments.",
    procedure: "beglacct.p",
    entry: "beListAllDept",
    sampleInput: "",
  },
  {
    key: "gl.getProject",
    label: "BeGL.getProject",
    description: "Get a single project.",
    procedure: "beglacct.p",
    entry: "beGetProject",
    sampleInput: "test 1",
  },
  {
    key: "gl.listProjects",
    label: "BeGL.listProjects",
    description: "List projects by structured dept/account/query input.",
    procedure: "beglacct.p",
    entry: "beListProjects",
    sampleInput: `{
  "dept": "2000",
  "account": "8200",
  "query": "test 1"
}`,
  },
  {
    key: "gl.allocationCodes",
    label: "BeGL.getAllocationCodes",
    description: "List GL allocation codes.",
    procedure: "beglacct.p",
    entry: "beGetAllocationCodes",
    sampleInput: "",
  },
  {
    key: "gl.isValidSubAccount",
    label: "BeGL.isValidSubAccount",
    description: "Validate one sub-account/account combination.",
    procedure: "beglacct.p",
    entry: "beIsValidSubAcct",
    sampleInput: `{
  "subAccount": "1000",
  "account": "8200",
  "budgetCode": "",
  "reqType": "",
  "site": ""
}`,
  },
  {
    key: "gl.isValidSubAccountTT",
    label: "BeGL.isValidSubAccountTT",
    description: "Validate many sub-account/account combinations using dsGL.ttValidSub.",
    procedure: "beglacct.p",
    entry: "beIsValidSubAcctTT",
    sampleInput: `{
  "rows": [
    { "subAccount": "1000", "account": "8200" },
    { "subAccount": "1001", "account": "8200" }
  ],
  "budgetCode": "",
  "reqType": "",
  "site": ""
}`,
  },
  {
    key: "gl.isValidAccount",
    label: "BeGL.isValidAccount",
    description: "Validate a GL account/sub/dept/project combination.",
    procedure: "beglacct.p",
    entry: "beIsValidAccount",
    sampleInput: `{
  "account": "8200",
  "subAccount": "1000",
  "dept": "2000",
  "project": "test 1",
  "budgetCode": "",
  "reqType": "",
  "site": ""
}`,
  },
  {
    key: "general.getLastTRNbr",
    label: "BeGeneral.getLastTRNbr",
    description: "Get the latest inventory transaction number.",
    procedure: "begeneral.p",
    entry: "beGetLastTRNbr",
    sampleInput: "",
  },
  {
    key: "general.getLatestTransactionHistory",
    label: "BeGeneral.getLatestTransactionHistory",
    description: "Get transaction history after a start number/date.",
    procedure: "begeneral.p",
    entry: "beGetLatestTransactionHistory",
    sampleInput: `{
  "typeList": "RCT-PO,ISS-PRV",
  "start": 0,
  "lastDate": "03/01/2026",
  "minResults": false
}`,
  },
  {
    key: "general.getCreditTerms",
    label: "BeGeneral.getCreditTerms",
    description: "Get one credit term.",
    procedure: "begeneral.p",
    entry: "beGetCTMstr",
    sampleInput: "2/10-30",
  },
  {
    key: "general.listCreditTerms",
    label: "BeGeneral.listCreditTerms",
    description: "List all credit terms.",
    procedure: "begeneral.p",
    entry: "beListCTMstr",
    sampleInput: "",
  },
  {
    key: "general.getSalesPerson",
    label: "BeGeneral.getSalesPerson",
    description: "Get one salesperson by address code.",
    procedure: "begeneral.p",
    entry: "beGetSPMstr",
    sampleInput: "CDO",
  },
  {
    key: "general.listSalesPersons",
    label: "BeGeneral.listSalesPersons",
    description: "List all salespersons.",
    procedure: "begeneral.p",
    entry: "beListSPMstr",
    sampleInput: "",
  },
  {
    key: "general.getTrailerCode",
    label: "BeGeneral.getTrailerCode",
    description: "Get one trailer code.",
    procedure: "begeneral.p",
    entry: "beGetTRLMstr",
    sampleInput: "10",
  },
  {
    key: "general.listTrailerCodes",
    label: "BeGeneral.listTrailerCodes",
    description: "List all trailer codes.",
    procedure: "begeneral.p",
    entry: "beListTRLMstr",
    sampleInput: "",
  },
  {
    key: "general.listCountryCodes",
    label: "BeGeneral.listCountryCodes",
    description: "List all country codes.",
    procedure: "begeneral.p",
    entry: "beListCTRYMstr",
    sampleInput: "",
  },
  {
    key: "general.getWorkDays",
    label: "BeGeneral.getWorkDays",
    description: "Calculate a workday offset for site/address/date/days.",
    procedure: "begeneral.p",
    entry: "beWorkDaysAhead",
    sampleInput: `{
  "site": "10000",
  "address": "5004000",
  "date": "03/11/2026",
  "days": 5
}`,
  },
  {
    key: "inventory.getUnplannedIssueStructure",
    label: "BeInventory.getUnplannedIssueStructure",
    description: "Get the longchar XML structure for unplanned issue.",
    procedure: "beinventory.p",
    entry: "beGetUnplannedIssueStructure",
    sampleInput: "",
  },
  {
    key: "inventory.unplannedIssue",
    label: "BeInventory.unplannedIssue",
    description: "Run inventory unplanned issue using XML longchar input.",
    procedure: "beinventory.p",
    entry: "beUnplannedIssue",
    sampleInput: "",
    sampleLongchar: "<dsUnplannedIssue></dsUnplannedIssue>",
  },
  {
    key: "inventory.getTransferStructure",
    label: "BeInventory.getInventoryTransferStructure",
    description: "Get the longchar XML structure for inventory transfer.",
    procedure: "beinventory.p",
    entry: "beGetInventoryTransferStructure",
    sampleInput: "",
  },
  {
    key: "inventory.transfer",
    label: "BeInventory.transferInventory",
    description: "Run inventory transfer using real dsInventoryTransfer XML input.",
    procedure: "beinventory.p",
    entry: "beTransferInventory",
    sampleInput: "",
    sampleLongchar: `<?xml version="1.0"?><dsInventoryTransfer xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ttInventoryTransfer><part xsi:nil="true"/><qty xsi:nil="true"/><effdate xsi:nil="true"/><nbr xsi:nil="true"/><soJob xsi:nil="true"/><rmks xsi:nil="true"/><transferAllocInv xsi:nil="true"/><statusConflict xsi:nil="true"/><useDefaultStatus xsi:nil="true"/><newStatus xsi:nil="true"/><siteFrom xsi:nil="true"/><locFrom xsi:nil="true"/><lotFrom xsi:nil="true"/><refFrom xsi:nil="true"/><siteTo xsi:nil="true"/><locTo xsi:nil="true"/><lotTo xsi:nil="true"/><refTo xsi:nil="true"/><vendorSource xsi:nil="true"/><vendor xsi:nil="true"/><receiver xsi:nil="true"/><poNbr xsi:nil="true"/><line xsi:nil="true"/><qtyOrd xsi:nil="true"/><category xsi:nil="true"/><event xsi:nil="true"/><reasonCode xsi:nil="true"/><docNbr xsi:nil="true"/><apiExternalKey xsi:nil="true"/><apiSuccess xsi:nil="true"/><apiSequence xsi:nil="true"/></ttInventoryTransfer></dsInventoryTransfer>`,
  },
  {
    key: "inventory.getLocInfo",
    label: "BeInventory.getLocInfo",
    description: "Get one inventory location/lot record.",
    procedure: "beinventory.p",
    entry: "beGetLocInfo",
    sampleInput: `{
  "item": "22-110",
  "site": "10000",
  "location": "100",
  "lot": "",
  "ref": ""
}`,
  },
  {
    key: "inventory.getLots",
    label: "BeInventory.getLots",
    description: "List inventory lots by item/site/lot/ref filter.",
    procedure: "beinventory.p",
    entry: "beGetLots",
    sampleInput: `{
  "item": "22-110",
  "site": "10000",
  "lot": "",
  "ref": ""
}`,
  },
  {
    key: "inventory.getLocStatus",
    label: "BeInventory.getLocStatus",
    description: "Get location status for site/location.",
    procedure: "beinventory.p",
    entry: "beGetLocStatus",
    sampleInput: `{
  "site": "10000",
  "location": "999"
}`,
  },
  {
    key: "invoice.get",
    label: "BeInvoice.getInvoice",
    description: "Get invoice header and lines by invoice number.",
    procedure: "beinvoice.p",
    entry: "beGetInvoice",
    sampleInput: "IV300022",
  },
  {
    key: "invoice.getByRowid",
    label: "BeInvoice.getInvoiceByRowid",
    description: "Get invoice header and lines by rowid string.",
    procedure: "beinvoice.p",
    entry: "beGetInvoiceByRowid",
    sampleInput: "",
  },
  {
    key: "invoice.createPending",
    label: "BeInvoice.createPendingInvoice",
    description: "Create a pending invoice using XML longchar input.",
    procedure: "beinvoice.p",
    entry: "beCreatePendingInvoice",
    sampleInput: "",
    sampleLongchar: "<PendingInvoice></PendingInvoice>",
  },
  {
    key: "invoice.setOrderTypes",
    label: "BeInvoice.setOrderTypes",
    description: "Update order types using dsOrderType XML payload.",
    procedure: "beinvoice.p",
    entry: "beSetOrderTypes",
    sampleInput: `{
  "rows": [
    {
      "site": "10000",
      "location": "100",
      "part": "22-110",
      "lot": "",
      "ref": "",
      "type": "SALE",
      "customer": ""
    }
  ]
}`,
  },
  {
    key: "order.get",
    label: "BeOrder.getOrder",
    description: "Get sales order header and lines by order number.",
    procedure: "beorder.p",
    entry: "beGetOrder",
    sampleInput: "SO10420",
  },
  {
    key: "order.getByRowid",
    label: "BeOrder.getOrderByRowid",
    description: "Get sales order header and lines by rowid string.",
    procedure: "beorder.p",
    entry: "beGetOrderByRowid",
    sampleInput: "",
  },
  {
    key: "order.listByCustomer",
    label: "BeOrder.listOrdersByCustomer",
    description: "List orders for a customer.",
    procedure: "beorder.p",
    entry: "beListOrdersByCustomer",
    sampleInput: "01000000",
  },
  {
    key: "order.linesByRowids",
    label: "BeOrder.listLinesByRowids",
    description: "Get sales order lines by comma-separated rowids.",
    procedure: "beorder.p",
    entry: "beGetSODByRowids",
    sampleInput: "",
  },
  {
    key: "order.clearEMT",
    label: "BeOrder.clearEMT",
    description: "Clear EMT data for one order line.",
    procedure: "beorder.p",
    entry: "beClearEMT",
    sampleInput: `{
  "orderNumber": "SO10420",
  "line": 1
}`,
  },
  {
    key: "order.getNextNumber",
    label: "BeOrder.getNextSONumber",
    description: "Get next sales order number.",
    procedure: "beorder.p",
    entry: "beGetNextSONbr",
    sampleInput: "",
  },
  {
    key: "po.getInvoicedQty",
    label: "BePO.getInvoicedQty",
    description: "Get invoiced quantity for a PO line.",
    procedure: "bepo.p",
    entry: "beGetInvoicedQty",
    sampleInput: `{
  "poNumber": "D133636",
  "line": 1
}`,
  },
  {
    key: "po.getPO",
    label: "BePO.getPO",
    description: "Get PO header and lines.",
    procedure: "bepo.p",
    entry: "beGetPODS",
    sampleInput: "D133636",
  },
  {
    key: "po.getPOLine",
    label: "BePO.getPOLine",
    description: "Get one PO line.",
    procedure: "bepo.p",
    entry: "beGetPOLine",
    sampleInput: `{
  "poNumber": "D133636",
  "line": 1
}`,
  },
  {
    key: "po.getTRHistReceipts",
    label: "BePO.getTRHistReceipts",
    description: "Get receipt transaction history after a starting transaction number.",
    procedure: "begeneral.p",
    entry: "beGetTRHistReceipts",
    sampleInput: "0",
  },
  {
    key: "po.getReceipts",
    label: "BePO.getPOReceipts",
    description: "Get receipt history for a PO.",
    procedure: "bepo.p",
    entry: "beGetPOReceipts",
    sampleInput: "D133636",
  },
  {
    key: "po.getStatus",
    label: "BePO.getPOStatus",
    description: "Get PO status.",
    procedure: "bepo.p",
    entry: "beGetPOStatus",
    sampleInput: "D133636",
  },
  {
    key: "po.getNextNumber",
    label: "BePO.getNextPONumber",
    description: "Get next standard PO number.",
    procedure: "bepo.p",
    entry: "beGetNextPONbr",
    sampleInput: "",
  },
  {
    key: "po.getNextNumberCustom",
    label: "BePO.getNextPONumberCustom",
    description: "Get next custom PO number from prefix and last number.",
    procedure: "bepo.p",
    entry: "beGetNextPONbrCustom",
    sampleInput: `{
  "prefix": "D",
  "lastNumber": 133632
}`,
  },
  {
    key: "po.openByItem",
    label: "BePO.getOpenPOByItem",
    description: "Search open POs by structured filter input.",
    procedure: "bepo.p",
    entry: "beGetOpenByItem",
    sampleInput: `{
  "item": "22-110",
  "vendor": "5004000",
  "buyer": "",
  "dueDateFrom": "",
  "dueDateTo": "",
  "poNumber": "",
  "project": "",
  "status": "ALL"
}`,
  },
  {
    key: "po.getCreateStructure",
    label: "BePO.getCreatePOStructure",
    description: "Get the longchar XML structure used for PO creation.",
    procedure: "bepo.p",
    entry: "beGetCreatePOStructure",
    sampleInput: "",
  },
  {
    key: "po.create",
    label: "BePO.createPO",
    description: "Create a PO using the longchar XML payload.",
    procedure: "bepo.p",
    entry: "beCreatePO",
    sampleInput: "",
    sampleLongchar: "<POCreate></POCreate>",
  },
  {
    key: "po.receive",
    label: "BePO.receivePO",
    description: "Receive PO D133636 qty 1 on line 1 using ds XML longchar input.",
    procedure: "bepo.p",
    entry: "beReceivePO",
    sampleInput: "",
    sampleLongchar: `<?xml version="1.0"?>
<ds xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ttReceipt>
    <ttLine>1</ttLine>
    <ttQty>1</ttQty>
  </ttReceipt>
  <ttOtherInfo>
    <ttKey></ttKey>
    <ttField>PONbr</ttField>
    <ttValue>D133636</ttValue>
  </ttOtherInfo>
</ds>`,
  },
  {
    key: "po.printOpen",
    label: "BePO.printOpenPO",
    description: "Print open POs for a supplier and return the longchar file payload.",
    procedure: "bepo.p",
    entry: "bePrintOpenPO",
    sampleInput: "5004000",
  },
  {
    key: "supplier.email",
    label: "BeSupplier.getSupplierEmail",
    description: "Get the supplier email return value.",
    procedure: "besupplier.p",
    entry: "beGetSupplierEmail",
    sampleInput: "5004000",
  },
];
