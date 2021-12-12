const {drivers: {v1: driver}} = require('../../db.js')
const {
  get_current_user_id,
  group_id_filter,
  error_handling,
  current_user_query,
  user_query,
  user_id_filter,
  group_query,
} = require('../../utils.js')

exports.get_administrators_of_group = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.make_user_administrator_of_group = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.remove_user_from_administrators = (req, res) => {
  res.status(410).send('Deprecated')
}

exports.get_groups_of_administrator = (req, res) => {
  res.status(410).send('Deprecated')
}
