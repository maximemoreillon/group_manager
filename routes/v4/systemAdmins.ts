import { Router } from "express"
import { get_system_admins } from "../../controllers/v4/systemAdmins"

const router = Router({ mergeParams: true })

router
  .route("/")
  .get(get_system_admins)
export default router
