const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const neo4j = require('neo4j-driver')
const axios = require('axios')
const dotenv = require('dotenv')
const auth = require('@moreillon/authentication_middleware')

dotenv.config()

var app_port = 80
if(process.env.APP_PORT) app_port=process.env.APP_PORT

var driver = neo4j.driver(
  process.env.NEO4J_URL,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
)

var app = express()
app.use(bodyParser.json())
app.use(cors())
app.use(auth.authenticate)

app.get('/', (req, res) => {
  // Splash screen
  res.send('Group management API, Maxime MOREILLON')
})

const group_controller = require('./controllers/group.js')
const member_controller = require('./controllers/member.js')
const administrator_controller = require('./controllers/administrator.js')
const subgroup_controller = require('./controllers/subgroup.js')


app.route('/group')
  .get(group_controller.get_group) // alternative way to get a single group
  .post(group_controller.create_group)
  .delete(group_controller.delete_group)

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

// Subgroups
app.route('/groups/:group_id/groups')
  .get(subgroup_controller.get_groups_of_group)

app.route('/groups/:group_id/parent_groups')
  .get(group_controller.get_parent_groups_of_group)

app.route('/groups/:group_id/groups/:subgroup_id')
  .post(subgroup_controller.add_group_to_group)
  .delete(subgroup_controller.remove_group_from_group)

app.route('/groups/:group_id/group')
  .post(subgroup_controller.add_group_to_group)
  .delete(subgroup_controller.remove_group_from_group)

// Members
app.route('/groups_of_user')
  .get(member_controller.get_groups_of_user)

app.route('/member/:member_id/groups')
  .get(member_controller.get_groups_of_user)

app.route('/groups/:group_id/members')
  .get(member_controller.get_members_of_group)

app.route('/groups/:group_id/member')
  .post(member_controller.add_member_to_group)
  .delete(member_controller.remove_user_from_group)

app.route('/groups/:group_id/members/:member_id')
  .post(member_controller.add_member_to_group)
  .delete(member_controller.remove_user_from_group)

app.route('/users_with_no_group')
  .get(member_controller.users_with_no_group)


// Administrators
app.route('/groups/:group_id/administrators')
  .get(administrator_controller.get_administrators_of_group)

app.route('/groups/:group_id/administrator')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

app.route('/groups/:group_id/administrators/:administrator_id')
  .post(administrator_controller.make_user_administrator_of_group)
  .delete(administrator_controller.remove_user_from_administrators)

app.route('/administrator/:administrator_id/groups')
  .get(administrator_controller.get_groups_of_administrator)

app.route('/groups_of_administrator')
  .get(administrator_controller.get_groups_of_administrator)



////////////
// LEGACY //
////////////

app.get('/group_by_id', group_controller.get_group)
app.post('/create_group', group_controller.create_group)
app.post('/delete_group', group_controller.delete_group)

app.get('/groups_directly_belonging_to_group', group_controller.get_groups_directly_belonging_to_group)
app.get('/parent_groups_of_group', group_controller.get_parent_groups_of_group)
app.get('/top_level_groups', group_controller.get_top_level_groups)
app.get('/top_level_groups/official', group_controller.get_top_level_official_groups)
app.get('/top_level_groups/non_official', group_controller.get_top_level_non_official_groups)


// TODO: Combine with below
app.post('/join_group', group_controller.join_group)
app.post('/leave_group', group_controller.leave_group)

// Users
app.get('/users_of_group', member_controller.get_members_of_group)

app.post('/remove_user_from_group', member_controller.remove_user_from_group)
app.post('/add_user_to_group', member_controller.add_member_to_group)


// Subgroups
app.get('/groups_of_group', subgroup_controller.get_groups_of_group)
app.post('/add_group_to_group', subgroup_controller.add_group_to_group)
app.post('/remove_group_from_group', subgroup_controller.remove_group_from_group)

// Administrators
app.get('/administrators_of_group', administrator_controller.get_administrators_of_group)
app.post('/make_user_administrator_of_group', administrator_controller.make_user_administrator_of_group)
app.post('/remove_user_from_administrators', administrator_controller.remove_user_from_administrators)

















app.listen(app_port, () => {
  console.log(`Group manager listening on port ${app_port}`)
})
