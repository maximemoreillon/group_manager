const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const axios = require('axios')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const router_v1 = require('./routes/v1/routes.js')
const router_v2 = require('./routes/v2/routes.js')
const pjson = require('./package.json')

dotenv.config()

const APP_PORT = process.env.APP_PORT || 80

const app = express()
app.use(bodyParser.json())
app.use(cors())
app.use(apiMetrics())


app.get('/', (req, res) => {
  res.send({
    application_name: 'Group Manager API',
    version: pjson.version,
    neo4j_url: process.env.NEO4J_URL,
    authentication_api_url: process.env.AUTHENTICATION_API_URL,
  })
})

app.use('/', router_v1)
app.use('/v2', router_v2)



app.listen(APP_PORT, () => {
  console.log(`Group manager listening on port ${APP_PORT}`)
})
