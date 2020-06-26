const express = require('express')

const controller = require('../controllers/administrator.js')

const router = express.Router({mergeParams: true})

router.route('/')
  .get(controller.get_administrators_of_group)

router.route('/:user_id')
  .post(controller.add_user_to_administrators)
  .delete(controller.remove_user_from_administrators)

module.exports = router
