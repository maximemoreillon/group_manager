exports.get_user_id_for_viewing = (req, res) => {

  // Returns the user ID specified in the body is available
  // otherwise returns ID of the current user

  if('employee_id' in req.body) return req.body.employee_id
  if('employee_id' in req.query) return req.query.employee_id

  if('user_id' in req.body) return req.body.user_id
  if('user_id' in req.query) return req.query.user_id

  // if nothing, just use the logged in user
  return res.locals.user.identity.low
}

exports.get_user_id_for_modification = (req, res) => {

  // gets the user ID from the request body and only allow to proceed if matches that of the current user

  // TODO: Use user_id instead of employee_id

  // If not requiring particular employee, just return self
  if(! ('employee_id' in req.body)) return res.locals.user.identity.low

  if(res.locals.user.identity.low !== req.body.employee_id) {
    // Does not get gaught by Neo4j catch!
    res.status(403).send(`Cannot edit someone else's info`)
    throw "Cannot edit someone else's info"
  }
  else return eq.body.employee_id
}
