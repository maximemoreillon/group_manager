const express = require('express')

const controller = require('../controllers/group.js')

const router = express.Router({mergeParams: true})

router.route('/')
  .post(controller.create_group)
  .get(controller.get_group) // can also be obtained using query

router.route('/:group_id')
  .get(controller.get_group)
  .delete(controller.delete_group)

const top_level_router = express.Router({mergeParams: true})

top_level_router.route('/').get(controller.get_top_level_groups)
top_level_router.route('/official').get(controller.get_top_level_official_groups)
top_level_router.route('/non_official').get(controller.get_top_level_non_official_groups)

router.use('/top_level', top_level_router)

module.exports = router
