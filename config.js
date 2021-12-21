const dotenv = require('dotenv')
dotenv.config()


const {
  DEFAULT_BATCH_SIZE = 100
} = process.env

exports.default_batch_size = DEFAULT_BATCH_SIZE
