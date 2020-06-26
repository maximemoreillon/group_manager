const express = require('express')

const controller = require('../controllers/member.js')

const router = express.Router({mergeParams: true})

router.route('/')
  .get(controller.get_members_of_group)

router.route('/:user_id')
  .post(controller.add_member_to_group)
  .delete(controller.remove_user_from_group)

module.exports = router
