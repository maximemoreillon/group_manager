import { Router } from "express"

import administrator_router from "./administrators"
import member_router from "./members"

import {
  create_group,
  get_groups,
  get_top_level_groups,
  get_top_level_official_groups,
  get_top_level_non_official_groups,
  get_group,
  patch_group,
  delete_group,
  join_group,
  leave_group,
  get_groups_of_group,
  add_group_to_group,
  remove_group_from_group,
  get_groups_directly_belonging_to_group,
  get_parent_groups_of_group,
} from "../../controllers/v2/groups"
import {
  get_members_of_groups,
  users_with_no_group,
} from "../../controllers/v2/members"

const router = Router()

router.route("/groups").post(create_group).get(get_groups)

// THOSE SHOULD NOT BE USED ANYMORE
router.route("/groups/top_level").get(get_top_level_groups)
router.route("/groups/top_level/official").get(get_top_level_official_groups)
router
  .route("/groups/top_level/non_official")
  .get(get_top_level_non_official_groups)

// slightly exceptional routes
router.route("/groups/members").get(get_members_of_groups)
router.route("/groups/users").get(get_members_of_groups)
router.route("/groups/none/members").get(users_with_no_group)
router.route("/groups/none/users").get(users_with_no_group)

router
  .route("/groups/:group_id")
  .get(get_group)
  .patch(patch_group)
  .delete(delete_group)

router.route("/groups/:group_id/join").post(join_group) // try to combine with add user to group
router.route("/groups/:group_id/leave").post(leave_group) // try to combine with add user to group

// Subgroups
router
  .route("/groups/:group_id/groups")
  .get(get_groups_of_group)
  .post(add_group_to_group)
  .delete(remove_group_from_group)

router
  .route("/groups/:group_id/groups/direct")
  .get(get_groups_directly_belonging_to_group) // Should not be used anymore

router.route("/groups/:group_id/parent_groups").get(get_parent_groups_of_group)
router.route("/groups/:group_id/parents").get(get_parent_groups_of_group) // alias

router
  .route("/groups/:group_id/groups/:subgroup_id")
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
