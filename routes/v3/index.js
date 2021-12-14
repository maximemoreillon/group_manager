const {Router} = require('express')

const administrator_router = require('./administrators.js')
const member_router = require('./members.js')

const group_controller = require('../../controllers/v3/groups.js')
const member_controller = require('../../controllers/v3/members.js')

const router = Router()

router.route('/groups')
  .post(group_controller.create_group)
  .get(group_controller.get_groups)

// slightly exceptional routes
router.route('/groups/members').get(member_controller.get_members_of_groups)
router.route('/groups/users').get(member_controller.get_members_of_groups)
router.route('/groups/none/members').get(member_controller.users_with_no_group)
router.route('/groups/none/users').get(member_controller.users_with_no_group)

router.route('/groups/:group_id')
  .get(group_controller.get_group)
  .patch(group_controller.patch_group)
  .delete(group_controller.delete_group)

router.route('/groups/:group_id/join').post(group_controller.join_group) // try to combine with add user to group
router.route('/groups/:group_id/leave').post(group_controller.leave_group) // try to combine with add user to group

// Subgroups
router.route('/groups/:group_id/groups')
  .get(group_controller.get_groups_of_group)
  .post(group_controller.add_group_to_group)
  .delete(group_controller.remove_group_from_group)

router.route('/groups/:group_id/parent_groups').get(group_controller.get_parent_groups_of_group)
router.route('/groups/:group_id/parents').get(group_controller.get_parent_groups_of_group) // alias

router.route('/groups/:group_id/groups/:subgroup_id')
  .post(group_controller.add_group_to_group)
  .delete(group_controller.remove_group_from_group)


router.use('/groups/:group_id/members', member_router)
router.use('/members', member_router)
router.use('/groups/:group_id/users', member_router)
router.use('/users', member_router)



// Administrators
router.use('/groups/:group_id/administrators', administrator_router)
router.use('/administrators', administrator_router)

module.exports = router
