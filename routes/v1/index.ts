import express from "express"

import {
  create_group,
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
} from "../../controllers/v1/groups"
import {
  get_user,
  get_groups_of_user,
  users_with_no_group,
  get_members_of_group,
  add_member_to_group,
  remove_user_from_group,
} from "../../controllers/v1/members"

const router = express.Router()

router.route("/groups").post(create_group) // deprecated

router.route("/groups/top_level").get(get_top_level_groups)

router.route("/groups/top_level/official").get(get_top_level_official_groups)

router
  .route("/groups/top_level/non_official")
  .get(get_top_level_non_official_groups)

router
  .route("/groups/:group_id")
  .get(get_group)
  .patch(patch_group) // deprecated
  .delete(delete_group) // deprecated

router.route("/groups/:group_id/join").post(join_group) // deprecated
router.route("/groups/:group_id/leave").post(leave_group) // deprecated

// Subgroups
router
  .route("/groups/:group_id/groups")
  .get(get_groups_of_group)
  .post(add_group_to_group)
  .delete(remove_group_from_group)

router
  .route("/groups/:group_id/groups/direct")
  .get(get_groups_directly_belonging_to_group)

router.route("/groups/:group_id/parent_groups").get(get_parent_groups_of_group)

router
  .route("/groups/:group_id/groups/:subgroup_id")
  .post(add_group_to_group)
  .delete(remove_group_from_group)

// Members
router.route("/members/:member_id").get(get_user)

router.route("/members/:member_id/groups").get(get_groups_of_user)

router.route("/groups/none/members").get(users_with_no_group)

router
  .route("/groups/:group_id/members")
  .get(get_members_of_group)
  .post(add_member_to_group) // providing user id in the request body
  .delete(remove_user_from_group) // providing user id in the query

router
  .route("/groups/:group_id/members/:member_id")
  .post(add_member_to_group) // providing user id in the url
  .delete(remove_user_from_group) // providing user id in the url

// Aliases for members
router.route("/users/:member_id").get(get_user)

router.route("/users/:member_id/groups").get(get_groups_of_user)

router.route("/groups/none/users").get(users_with_no_group)

router
  .route("/groups/:group_id/users")
  .get(get_members_of_group)
  .post(add_member_to_group) // providing user id in the request body
  .delete(remove_user_from_group) // providing user id in the query

router
  .route("/groups/:group_id/users/:member_id")
  .post(add_member_to_group) // providing user id in the url
  .delete(remove_user_from_group) // providing user id in the url

export default router
