import { DomainMgr } from "@/lib/qad/DomainMgr";
import type { GetDataParams } from "@/lib/qad/proxy";

export type GetDataRequest = GetDataParams;

export class GetDataService {
  static async get(params: GetDataRequest) {
    return DomainMgr.getData(params);
  }
}
