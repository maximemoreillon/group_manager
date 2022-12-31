const { Router } = require("express")

const administrator_router = require("./administrators.js")
const member_router = require("./members.js")

const {
  create_group,
  get_groups,
  get_group,
  patch_group,
  delete_group,
  join_group,
  leave_group,
  get_groups_of_group,
  add_group_to_group,
  remove_group_from_group,
  get_parent_groups_of_group,
} = require("../../controllers/v3/groups.js")
const { users_with_no_group } = require("../../controllers/v3/members.js")

const router = Router()

router.route("/groups").post(create_group).get(get_groups)

// slightly exceptional routes
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

module.exports = router
