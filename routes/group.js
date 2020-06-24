const express = require('express')

const group_controller = require('../controllers/group.js')

const router = express.Router()

router.use('/')
  .post(group_controller.create_group)
  .delete(group_controller.delete_group)

module.exports = router
