const {Router} = require('express')

const administrator_controller = require('../../controllers/v2/administrators.js')

const router = Router({mergeParams: true})

router.route('/')
  .get(administrator_controller.get_administrators_of_group)

router.route('/')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

router.route('/:administrator_id')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

router.route('/:administrator_id/groups')
  .get(administrator_controller.get_groups_of_administrator)

module.exports = router
