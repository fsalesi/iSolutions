/**
 * Vendor service compatibility layer.
 *
 * Use BeSupplierService for new code.
 */

import {
  BeSupplierService,
  type VendorDetail,
  type VendorSummary,
} from "./services/BeSupplierService";

export { BeSupplierService, type VendorDetail, type VendorSummary };

export const listSuppliers = BeSupplierService.listSuppliers;
export const listSuppliersMatch = BeSupplierService.listSuppliersMatch;
export const getSupplier = BeSupplierService.getSupplier;
export const getSupplierBySort = BeSupplierService.getSupplierBySort;
export const getSupplierEmail = BeSupplierService.getSupplierEmail;
