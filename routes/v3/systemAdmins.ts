import { Router } from "express"
import { get_system_admins } from "../../controllers/v3/systemAdmins"

const router = Router({ mergeParams: true })

router
  .route("/")
  .get(get_system_admins)
export default router
