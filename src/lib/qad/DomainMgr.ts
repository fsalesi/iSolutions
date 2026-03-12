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
  type GetDataParams,
  type QADCallParams,
} from "./proxy";

export type DomainMgrCall = QADCallParams;
export type DomainMgrGetData = GetDataParams;

export class DomainMgr {
  static async call(params: DomainMgrCall): Promise<any> {
    return callQADProxy(params);
  }

  static async getData(params: DomainMgrGetData): Promise<any[]> {
    return getQADDataProxy(params);
  }
}
