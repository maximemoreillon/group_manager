import { Router } from "express"

import administrator_router from "./administrators"
import member_router from "./members"

import {
  create_group,
  read_groups,
  read_group,
  update_group,
  delete_group,
  add_group_to_group,
  remove_group_from_group,
} from "../../controllers/v3/groups"
import { users_with_no_group } from "../../controllers/v3/members"

const router = Router()

router.route("/groups").post(create_group).get(read_groups)

// slightly exceptional routes
router.route("/groups/none/members").get(users_with_no_group)
router.route("/groups/none/users").get(users_with_no_group)

router
  .route("/groups/:group_id")
  .get(read_group)
  .patch(update_group)
  .delete(delete_group)

// Subgroups
router
  .route("/groups/:parent_id/groups")
  .get(read_groups)
  .post(add_group_to_group)
  .delete(remove_group_from_group)

router.route("/groups/:subgroup_id/parent_groups").get(read_groups)
router.route("/groups/:subgroup_id/parents").get(read_groups) // alias

router
  .route("/groups/:parent_id/groups/:subgroup_id")
  .post(add_group_to_group)
  .delete(remove_group_from_group)

router.use("/groups/:group_id/members", member_router)
router.use("/members", member_router)
router.use("/groups/:group_id/users", member_router)
router.use("/users", member_router)

// Administrators
router.use("/groups/:group_id/administrators", administrator_router)
router.use("/administrators", administrator_router)

export default router
