/**
 * CustomerUsersRoute — Customer API route override.
 * Extends the product route. Customer developers add their logic here.
 * This file is NEVER overwritten by product upgrades.
 * Use super to call product behavior, skip it to replace entirely.
 */
import { UsersRoute } from "@/app/api/users/route";

export default class CustomerUsersRoute extends UsersRoute {
}
