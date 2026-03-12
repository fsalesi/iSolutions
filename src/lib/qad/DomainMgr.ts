/**
 * DomainMgr — single gateway for all QAD/OpenEdge calls from iSolutions.
 *
 * This is the v2 replacement for the transport/gateway role of the OE
 * DomainMgr.cls, intentionally simplified for iSolutions:
 * - no proxy/local branching here
 * - no caching
 * - one PASOE transport path only
 */

import {
  callQAD as callQADProxy,
  getQADData as getQADDataProxy,
  getQADFile as getQADFileProxy,
  type GetDataParams,
  type QADCallParams,
  type QADFileResult,
} from "./proxy";

export type DomainMgrCall = QADCallParams;
export type DomainMgrGetData = GetDataParams;
export interface DomainMgrGetDataResult {
  dataset: any;
  rows: any[];
  raw: any;
}

export class DomainMgr {
  static async call(params: DomainMgrCall): Promise<any> {
    return callQADProxy(params);
  }

  static async getData(params: DomainMgrGetData): Promise<DomainMgrGetDataResult> {
    return getQADDataProxy(params);
  }

  static async getFile(params: { domain: string; file: string }): Promise<QADFileResult> {
    return getQADFileProxy(params);
  }
}
