const express = require('express')

const group_controller = require('../../controllers/v3/groups.js')
const member_controller = require('../../controllers/v3/members.js')
const administrator_controller = require('../../controllers/v3/administrators.js')


const router = express.Router()

router.route('/groups')
  .get(group_controller.get_groups)


module.exports = router
