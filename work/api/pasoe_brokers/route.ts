/**
 * CustomerPasoeBrokersRoute — Customer API route override.
 * Extends the product route. Customer developers add their logic here.
 * This file is NEVER overwritten by product upgrades.
 * Use super to call product behavior, skip it to replace entirely.
 */
import { PasoeBrokersRoute } from "@/app/api/pasoe_brokers/route";

export default class CustomerPasoeBrokersRoute extends PasoeBrokersRoute {
}
