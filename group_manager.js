const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const axios = require('axios')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')

const auth = require('@moreillon/authentication_middleware')
const pjson = require('./package.json')

dotenv.config()

const APP_PORT = process.env.APP_PORT || 80

const app = express()
app.use(bodyParser.json())
app.use(cors())
app.use(apiMetrics())
app.use(auth.authenticate)

app.get('/', (req, res) => {
  res.send({
    application_name: 'Group Manager API',
    version: pjson.version,
    neo4j_url: process.env.NEO4J_URL,
    authentication_api_url: process.env.AUTHENTICATION_API_URL,
  })
})

const group_controller = require('./controllers/groups.js')
const member_controller = require('./controllers/members.js')
const administrator_controller = require('./controllers/administrators.js')


app.route('/groups')
  .post(group_controller.create_group)

app.route('/groups/top_level')
  .get(group_controller.get_top_level_groups)

app.route('/groups/top_level/official')
  .get(group_controller.get_top_level_official_groups)

app.route('/groups/top_level/non_official')
  .get(group_controller.get_top_level_non_official_groups)

app.route('/groups/:group_id')
  .get(group_controller.get_group)
  .patch(group_controller.patch_group)
  .delete(group_controller.delete_group)

app.route('/groups/:group_id/join')
  .post(group_controller.join_group)

app.route('/groups/:group_id/leave')
  .post(group_controller.leave_group)

// Subgroups
app.route('/groups/:group_id/groups')
  .get(group_controller.get_groups_of_group)
  .post(group_controller.add_group_to_group)
  .delete(group_controller.remove_group_from_group)

app.route('/groups/:group_id/groups/direct')
  .get(group_controller.get_groups_directly_belonging_to_group)

app.route('/groups/:group_id/parent_groups')
  .get(group_controller.get_parent_groups_of_group)

app.route('/groups/:group_id/groups/:subgroup_id')
  .post(group_controller.add_group_to_group)
  .delete(group_controller.remove_group_from_group)

// Members
app.route('/members/:member_id')
  .get(member_controller.get_user)

app.route('/members/:member_id/groups')
  .get(member_controller.get_groups_of_user)

app.route('/groups/none/members')
  .get(member_controller.users_with_no_group)

app.route('/groups/:group_id/members')
  .get(member_controller.get_members_of_group)
  .post(member_controller.add_member_to_group) // providing user id in the request body
  .delete(member_controller.remove_user_from_group) // providing user id in the query

app.route('/groups/:group_id/members/:member_id')
  .post(member_controller.add_member_to_group) // providing user id in the url
  .delete(member_controller.remove_user_from_group) // providing user id in the url

// Aliases for members
app.route('/users/:member_id')
  .get(member_controller.get_user)

app.route('/users/:member_id/groups')
  .get(member_controller.get_groups_of_user)

app.route('/groups/none/users')
  .get(member_controller.users_with_no_group)

app.route('/groups/:group_id/users')
  .get(member_controller.get_members_of_group)
  .post(member_controller.add_member_to_group) // providing user id in the request body
  .delete(member_controller.remove_user_from_group) // providing user id in the query

app.route('/groups/:group_id/users/:member_id')
  .post(member_controller.add_member_to_group) // providing user id in the url
  .delete(member_controller.remove_user_from_group) // providing user id in the url

// Administrators
app.route('/groups/:group_id/administrators')
  .get(administrator_controller.get_administrators_of_group)

app.route('/groups/:group_id/administrator')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

app.route('/groups/:group_id/administrators/:administrator_id')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

app.route('/administrators/:administrator_id/groups')
  .get(administrator_controller.get_groups_of_administrator)


app.listen(APP_PORT, () => {
  console.log(`Group manager listening on port ${APP_PORT}`)
})
