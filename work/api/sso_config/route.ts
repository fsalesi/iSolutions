/**
 * CustomerSsoConfigRoute — Customer API route override.
 * Extends the product route. Customer developers add their logic here.
 * This file is NEVER overwritten by product upgrades.
 * Use super to call product behavior, skip it to replace entirely.
 */
import { SsoConfigRoute } from "@/app/api/sso_config/route";

export default class CustomerSsoConfigRoute extends SsoConfigRoute {
}
