const express = require('express')
const cors = require('cors')
const axios = require('axios')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const router_v1 = require('./routes/v1/index.js')
const router_v2 = require('./routes/v2/index.js')
const router_v3 = require('./routes/v3/index.js')
const {version, author} = require('./package.json')
const {commit} = require('./commit.json')
const auth = require('@moreillon/express_identification_middleware')
const {
  url: neo4j_url,
  connected: neo4j_connected,
} = require('./db.js')

dotenv.config()

const APP_PORT = process.env.APP_PORT || 80

const identification_url = process.env.IDENTIFICATION_URL
  || `${process.env.AUTHENTICATION_API_URL}/v2/whoami`

const auth_options = { url:  identification_url}

const app = express()
app.use(express.json())
app.use(cors())
app.use(apiMetrics())


app.get('/', (req, res) => {
  res.send({
    application_name: 'Group Manager',
    version,
    author,
    neo4j: {
      url: neo4j_url,
    },
    identification_url,
    commit,
  })
})

// From here on, all routes are protected
app.use(auth(auth_options))
app.use('/', router_v1)
app.use('/v1', router_v1) //alias
app.use('/v2', router_v2)
app.use('/v3', router_v3)



app.listen(APP_PORT, () => {
  console.log(`Group manager listening on port ${APP_PORT}`)
})

exports.app = app