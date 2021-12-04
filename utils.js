exports.get_current_user_id = (res) => {
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}
