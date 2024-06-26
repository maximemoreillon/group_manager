import request from "supertest"
import { expect } from "chai"
import { app } from "../index"
import axios from "axios"

const {
  LOGIN_URL,
  IDENTIFICATION_URL,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env as any

const sleep = (delay: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay)
  })

const login = async () => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD }
  const {
    data: { jwt },
  } = await axios.post(LOGIN_URL, body)
  return jwt
}

const whoami = async (jwt: string) => {
  const headers = { authorization: `bearer ${jwt}` }
  const { data: user } = await axios.get(IDENTIFICATION_URL, { headers })
  return user
}

// We will test for api users
describe("/v1", () => {
  let user: any, jwt: string, group_id: string

  before(async () => {
    //console.log = function () {}
    await sleep(10000)
    jwt = await login()
    user = await whoami(jwt)
  })

  describe("POST /v1/groups", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .post("/v1/groups")
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(410)
    })
  })

  describe("POST /v2/groups", () => {
    it("Should allow the creation of groups", async () => {
      const { body, status } = await request(app)
        .post("/v2/groups")
        .send({ name: "tdd_v1" })
        .set("Authorization", `Bearer ${jwt}`)

      if (body.properties) group_id = body.properties._id
      expect(status).to.equal(200)
    })
  })

  describe("GET /v1/groups/top_level", () => {
    it("Should allow the query of groups", async () => {
      const { status } = await request(app)
        .get("/v1/groups/top_level")
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /v1/group/:group_id", () => {
    it("Should allow the query of a single group", async () => {
      const { status } = await request(app)
        .get(`/v1/groups/${group_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should respond 404 to inexistent group", async () => {
      const { status } = await request(app)
        .get(`/v1/groups/111111`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
    })
  })

  describe("GET /v1/groups/:group_id/members/", () => {
    it("Should allow querying members of a group", async () => {
      const { status } = await request(app)
        .get(`/v1/groups/${group_id}/members/`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should allow querying members of no group", async () => {
      const { status } = await request(app)
        .get(`/v1/groups/none/members/`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /v1/users/self/groups/", () => {
    it("Should allow to get one's groups", async () => {
      const { status, body } = await request(app)
        .get(`/v1/users/self/groups/`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /v1/groups/:group_id/groups/", () => {
    it("Should allow the query of subgroups", async () => {
      const { status, body } = await request(app)
        .get(`/v1/groups/${group_id}/groups/`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /v1/groups/:group_id/groups/direct", () => {
    it("Should allow the query of direct subgroups", async () => {
      const { status } = await request(app)
        .get(`/v1/groups/${group_id}/groups/direct`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /v1/groups/:group_id", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .delete(`/v1/groups/${group_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(410)
    })
  })

  describe("DELETE /v2/groups/:group_id", () => {
    it("Should allow the deletion of a group", async () => {
      const { status } = await request(app)
        .delete(`/v2/groups/${group_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })
})
