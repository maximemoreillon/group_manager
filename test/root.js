const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")


// We will test for api users
describe("/", () => {

  beforeEach( async () => {
    console.log = function () {}
  })

  describe("GET /", () => {
    it("Should respond with the application info", async () => {
      const res = await request(app)
        .get("/")

      expect(res.status).to.equal(200)
    })

  })

})
