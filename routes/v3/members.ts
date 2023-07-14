import { Router } from "express"

import {
  get_members_of_group,
  get_user,
  get_groups_of_user,
  add_member_to_group,
  remove_user_from_group,
  get_groups_of_users,
} from "../../controllers/v3/members"

const router = Router({ mergeParams: true })

router.route("/").get(get_members_of_group).post(add_member_to_group)

router.route("/groups").get(get_groups_of_users)

router.route("/:member_id").get(get_user).delete(remove_user_from_group)

router.route("/:member_id/groups").get(get_groups_of_user)

export default router
