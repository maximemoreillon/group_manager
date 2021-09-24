const express = require('express')
const auth = require('@moreillon/authentication_middleware')

const group_controller = require('../../controllers/v3/groups.js')
const member_controller = require('../../controllers/v3/members.js')
const administrator_controller = require('../../controllers/v3/administrators.js')


const router = express.Router()

// use the router

router.use(auth.authenticate)

router.route('/groups')
  .get(group_controller.get_groups)


module.exports = router
