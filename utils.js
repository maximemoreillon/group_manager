exports.get_current_user_id = (res) => {
  const current_user = res.locals.user
  const _id = current_user._id
    || current_user.properties._id
    || current_user.identity.low
    || current_user.identity

  return _id
}


exports.error_handling = (error, res) => {

  console.log(error)

  let status_code = error.code || 500
  if(isNaN(status_code)) status_code = 500
  const message = error.message || error
  res.status(status_code).send(message)
}


exports.user_id_filter = `
WHERE user._id = $user_id
`
exports.user_query = `
MATCH (user:User)
${exports.user_id_filter}
`

exports.current_user_query = `
MATCH (current_user:User)
WHERE current_user._id = $current_user_id
`


exports.group_id_filter = `
WHERE group._id = $group_id
// OR id(group)=toInteger($group_id)
`

exports.group_query = `
MATCH (group:Group)
${exports.group_id_filter}
`
