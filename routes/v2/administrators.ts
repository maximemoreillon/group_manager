import { Router } from "express"

import {
  get_administrators_of_group,
  make_user_administrator_of_group,
  remove_user_from_administrators,
  get_groups_of_administrator,
} from "../../controllers/v2/administrators"

const router = Router({ mergeParams: true })

router
  .route("/")
  .get(get_administrators_of_group)
  .post(make_user_administrator_of_group)

router.route("/:administrator_id").delete(remove_user_from_administrators)

router.route("/:administrator_id/groups").get(get_groups_of_administrator)

export default router
