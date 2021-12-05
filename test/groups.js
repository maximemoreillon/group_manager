const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")
const axios = require('axios')

const {
  LOGIN_URL,
  IDENTIFICATION_URL,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env

const login = async () => {
  const body = {username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD}
  const {data: {jwt}} = await axios.post(LOGIN_URL,body)
  return jwt
}

const whoami = async (jwt) => {
  const headers = {authorization: `bearer ${jwt}`}
  const {data: user} = await axios.get(IDENTIFICATION_URL,{headers})
  return user
}

// We will test for api users
describe("/groups", () => {

  let user, jwt, group_id


  beforeEach( async () => {
    //console.log = function () {}
    jwt = await login()
    user = await whoami(jwt)
  })

  describe("POST /groups", () => {
    it("Should allow the creation of a group", async () => {
      const {status, body} = await request(app)
        .post("/v2/groups")
        .send({name: 'tdd'})
        .set('Authorization', `Bearer ${jwt}`)

      console.log(body)



      expect(status).to.equal(200)
    })

  })

})