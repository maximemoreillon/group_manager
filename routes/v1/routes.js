const express = require('express')
const auth = require('@moreillon/authentication_middleware')

const group_controller = require('../../controllers/v1/groups.js')
const member_controller = require('../../controllers/v1/members.js')
const administrator_controller = require('../../controllers/v1/administrators.js')


const router = express.Router()

// use the router

router.use(auth.authenticate)

router.route('/groups')
  .post(group_controller.create_group)

router.route('/groups/top_level')
  .get(group_controller.get_top_level_groups)

router.route('/groups/top_level/official')
  .get(group_controller.get_top_level_official_groups)

router.route('/groups/top_level/non_official')
  .get(group_controller.get_top_level_non_official_groups)

router.route('/groups/:group_id')
  .get(group_controller.get_group)
  .patch(group_controller.patch_group)
  .delete(group_controller.delete_group)

router.route('/groups/:group_id/join')
  .post(group_controller.join_group)

router.route('/groups/:group_id/leave')
  .post(group_controller.leave_group)

// Subgroups
router.route('/groups/:group_id/groups')
  .get(group_controller.get_groups_of_group)
  .post(group_controller.add_group_to_group)
  .delete(group_controller.remove_group_from_group)

router.route('/groups/:group_id/groups/direct')
  .get(group_controller.get_groups_directly_belonging_to_group)

router.route('/groups/:group_id/parent_groups')
  .get(group_controller.get_parent_groups_of_group)

router.route('/groups/:group_id/groups/:subgroup_id')
  .post(group_controller.add_group_to_group)
  .delete(group_controller.remove_group_from_group)

// Members
router.route('/members/:member_id')
  .get(member_controller.get_user)

router.route('/members/:member_id/groups')
  .get(member_controller.get_groups_of_user)

router.route('/groups/none/members')
  .get(member_controller.users_with_no_group)

router.route('/groups/:group_id/members')
  .get(member_controller.get_members_of_group)
  .post(member_controller.add_member_to_group) // providing user id in the request body
  .delete(member_controller.remove_user_from_group) // providing user id in the query

router.route('/groups/:group_id/members/:member_id')
  .post(member_controller.add_member_to_group) // providing user id in the url
  .delete(member_controller.remove_user_from_group) // providing user id in the url

// Aliases for members
router.route('/users/:member_id')
  .get(member_controller.get_user)

router.route('/users/:member_id/groups')
  .get(member_controller.get_groups_of_user)

router.route('/groups/none/users')
  .get(member_controller.users_with_no_group)

router.route('/groups/:group_id/users')
  .get(member_controller.get_members_of_group)
  .post(member_controller.add_member_to_group) // providing user id in the request body
  .delete(member_controller.remove_user_from_group) // providing user id in the query

router.route('/groups/:group_id/users/:member_id')
  .post(member_controller.add_member_to_group) // providing user id in the url
  .delete(member_controller.remove_user_from_group) // providing user id in the url

// Administrators
router.route('/groups/:group_id/administrators')
  .get(administrator_controller.get_administrators_of_group)

router.route('/groups/:group_id/administrator')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

router.route('/groups/:group_id/administrators/:administrator_id')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

router.route('/administrators/:administrator_id/groups')
  .get(administrator_controller.get_groups_of_administrator)

module.exports = router
