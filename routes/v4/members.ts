import { Router } from "express"

import {
  add_member_to_group,
  remove_user_from_group,
} from "../../controllers/v4/members"

const router = Router({ mergeParams: true })

router.route("/").post(add_member_to_group)
router.route("/:member_id").delete(remove_user_from_group)

export default router
