const express = require('express')

const controller = require('../controllers/subgroup.js')

const router = express.Router({mergeParams: true})

router.route('/')
  .get(controller.get_groups_of_group)

router.route('/:subgroup_id')
  .post(controller.add_group_to_group)
  .delete(controller.remove_group_from_group)




module.exports = router
