exports.get_current_user_id = (res) => {
  const current_user = res.locals.user
  const _id =
    current_user._id || // futureproofing
    current_user.properties._id ||
    current_user.identity.low || // remove this when done
    current_user.identity // remove this when done

  return _id
}

exports.user_id_filter = `WHERE user._id = $user_id`
exports.user_query = `MATCH (user:User {_id: $user_id})`
exports.current_user_query = `MATCH (current_user:User {_id: $current_user_id} )`
exports.group_id_filter = `WHERE group._id = $group_id`
exports.group_query = `MATCH (group:Group {_id: $group_id})`

exports.batch_items = (batch_size) => `
// Aggregation
WITH
  COLLECT(properties(item)) as items,
  COUNT(item) as count,
  toInteger($start_index) as start_index,
  toInteger($batch_size) as batch_size,
  (toInteger($start_index) + toInteger($batch_size)) as end_index

// Batching
// Note: if end_index is -1, returns all except last
RETURN
  count,
  ${
    batch_size >= 0
      ? "items[start_index..end_index] AS batch"
      : "items AS batch"
  },
  start_index,
  batch_size
`

exports.format_batched_response = (records) => {
  const record = records[0]

  // TODO: This is a dirty fix for missing result record
  if (!record)
    return {
      count: 0,
      items: [],
    }

  const items = record.get("batch")
  items.forEach((item) => {
    if (item.password_hashed) delete item.password_hashed
  })

  return {
    batch_size: record.get("batch_size"),
    start_index: record.get("start_index"),
    count: record.get("count"),
    items,
  }
}
