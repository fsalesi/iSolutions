import type { LookupConfig } from "../../LookupTypes";
import { createQadGetDataLookup } from "./GetDataLookup";

export const QadAccountLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'ac_mstr',
    domainField: 'ac_domain',
    valueField: 'ac_code',
    displayField: 'ac_desc',
    displayTemplate: '{ac_code} - {ac_desc}',
    searchWhere: "ac_active eq true and (($DOMAIN and ac_code begins '&1') or ($DOMAIN and ac_desc begins '&1'))",
    uniqueWhere: "$DOMAIN and ac_code eq '&1'",
    fieldSet: 'ac_code,ac_desc',
    searchColumns: ['ac_code', 'ac_desc'],
    gridColumns: [{ key: 'ac_code', label: 'Account' }, { key: 'ac_desc', label: 'Description' }],
    placeholder: 'Search accounts...',
  }, overrides);

export const QadCostCenterLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'cc_mstr',
    domainField: 'cc_domain',
    valueField: 'cc_ctr',
    displayField: 'cc_desc',
    displayTemplate: '{cc_ctr} - {cc_desc}',
    searchWhere: "cc_active eq true and (($DOMAIN and cc_ctr begins '&1') or ($DOMAIN and cc_desc begins '&1'))",
    uniqueWhere: "$DOMAIN and cc_ctr eq '&1'",
    fieldSet: 'cc_ctr,cc_desc',
    searchColumns: ['cc_ctr', 'cc_desc'],
    gridColumns: [{ key: 'cc_ctr', label: 'Cost Center' }, { key: 'cc_desc', label: 'Description' }],
    placeholder: 'Search cost centers...',
  }, overrides);

export const QadSubAccountLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'sb_mstr',
    domainField: 'sb_domain',
    valueField: 'sb_sub',
    displayField: 'sb_desc',
    displayTemplate: '{sb_sub} - {sb_desc}',
    searchWhere: "sb_active eq true and (($DOMAIN and sb_sub begins '&1') or ($DOMAIN and sb_desc begins '&1'))",
    uniqueWhere: "$DOMAIN and sb_sub eq '&1'",
    fieldSet: 'sb_sub,sb_desc',
    searchColumns: ['sb_sub', 'sb_desc'],
    gridColumns: [{ key: 'sb_sub', label: 'Sub Account' }, { key: 'sb_desc', label: 'Description' }],
    placeholder: 'Search sub accounts...',
  }, overrides);

export const QadProjectLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'pj_mstr',
    domainField: 'pj_domain',
    valueField: 'pj_project',
    displayField: 'pj_desc',
    displayTemplate: '{pj_project} - {pj_desc}',
    searchWhere: "pj_active eq true and (($DOMAIN and pj_project begins '&1') or ($DOMAIN and pj_desc begins '&1'))",
    uniqueWhere: "$DOMAIN and pj_project eq '&1'",
    fieldSet: 'pj_project,pj_desc',
    searchColumns: ['pj_project', 'pj_desc'],
    gridColumns: [{ key: 'pj_project', label: 'Project' }, { key: 'pj_desc', label: 'Description' }],
    placeholder: 'Search projects...',
  }, overrides);

export const QadCreditTermsLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'ct_mstr',
    domainField: 'ct_domain',
    valueField: 'ct_code',
    displayField: 'ct_desc',
    displayTemplate: '{ct_code} - {ct_desc}',
    searchWhere: "(($DOMAIN and ct_code begins '&1') or ($DOMAIN and ct_desc begins '&1'))",
    uniqueWhere: "$DOMAIN and ct_code eq '&1'",
    fieldSet: 'ct_code,ct_desc',
    searchColumns: ['ct_code', 'ct_desc'],
    gridColumns: [{ key: 'ct_code', label: 'Code' }, { key: 'ct_desc', label: 'Description' }],
    placeholder: 'Search credit terms...',
  }, overrides);

export const QadSiteLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'si_mstr',
    domainField: 'si_domain',
    valueField: 'si_site',
    displayField: 'si_desc',
    displayTemplate: '{si_site} - {si_desc}',
    searchWhere: "(($DOMAIN and si_site begins '&1') or ($DOMAIN and si_desc begins '&1'))",
    uniqueWhere: "$DOMAIN and si_site eq '&1'",
    fieldSet: 'si_site,si_desc',
    searchColumns: ['si_site', 'si_desc'],
    gridColumns: [{ key: 'si_site', label: 'Site' }, { key: 'si_desc', label: 'Description' }],
    placeholder: 'Search sites...',
  }, overrides);

export const QadCustomerLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  createQadGetDataLookup({
    table: 'cm_mstr',
    domainField: 'cm_domain',
    valueField: 'cm_addr',
    displayField: 'cm_sort',
    displayTemplate: '{cm_addr} - {cm_sort}',
    searchWhere: "(($DOMAIN and cm_addr begins '&1') or ($DOMAIN and cm_sort begins '&1'))",
    uniqueWhere: "$DOMAIN and cm_addr eq '&1'",
    fieldSet: 'cm_addr,cm_sort,cm_site,cm_balance,cm_cr_hold,cm_partial,cm_shipvia,cm_cr_terms,cm_bill,cm_ship',
    searchColumns: ['cm_addr', 'cm_sort'],
    gridColumns: [{ key: 'cm_addr', label: 'Customer' }, { key: 'cm_sort', label: 'Name' }, { key: 'cm_site', label: 'Site' }],
    placeholder: 'Search customers...',
  }, overrides);
