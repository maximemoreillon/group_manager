import request from "supertest";
import { expect } from "chai";
import { app } from "../index";
import axios from "axios";

const {
  LOGIN_URL,
  IDENTIFICATION_URL,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env as any;

const login = async () => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD };
  const {
    data: { jwt },
  } = await axios.post(LOGIN_URL, body);
  return jwt;
};

const whoami = async (jwt: string) => {
  const headers = { authorization: `bearer ${jwt}` };
  const { data: user } = await axios.get(IDENTIFICATION_URL, { headers });
  return user;
};

describe("/v2/", () => {
  let user: any, jwt: string, group_id: string, subgroup_id: string;

  before(async () => {
    jwt = await login();
    user = await whoami(jwt);

    let res = await request(app)
      .post("/v3/groups")
      .send({ name: "tdd_v2" })
      .set("Authorization", `Bearer ${jwt}`);
    group_id = res.body._id;

    res = await request(app)
      .post("/v3/groups")
      .send({ name: "tdd_v2_ub" })
      .set("Authorization", `Bearer ${jwt}`);
    subgroup_id = res.body._id;
  });

  after(async () => {
    await request(app)
      .delete(`/v3/groups/${group_id}`)
      .set("Authorization", `Bearer ${jwt}`);
    await request(app)
      .delete(`/v3/groups/${subgroup_id}`)
      .set("Authorization", `Bearer ${jwt}`);
  });

  describe("POST /v2/groups", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .post("/v2/groups")
        .send({ name: "tdd_v2" })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("GET /v2/groups", () => {
    it("Should allow the query of groups", async () => {
      const { status } = await request(app)
        .get("/v2/groups")
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it("Should allow the query of top level groups", async () => {
      const { status } = await request(app)
        .get("/v2/groups")
        .query({ top: 1 })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it("Should allow the query of top level official groups", async () => {
      const { status } = await request(app)
        .get("/v2/groups")
        .query({ top: 1, official: 1 })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("GET /v2/groups/:group_id", () => {
    it("Should allow the query of a single group", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/${group_id}`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it("Should respond 404 to an inexistent group", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/111111`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(404);
    });
  });

  describe("PATCH /v2/groups/:group_id", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .patch(`/v2/groups/${group_id}`)
        .send({ name: "banana" })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("POST /v2/groups/:group_id/members/", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .post(`/v2/groups/${group_id}/members/`)
        .send({ user_id: user._id })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("DELETE /v2/groups/:group_id/members/:member_id", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .delete(`/v2/groups/${group_id}/members/${user._id}`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("GET /v2/groups/:group_id/members/", () => {
    it("Should allow querying members of a group", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/${group_id}/members/`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });

    it("Should allow querying members of no group", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/none/members/`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("GET /v2/groups/:group_id/members/:member_id", () => {
    it("Should allow querying a member's information", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/${group_id}/members/self`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("GET /v2/users/self/groups/", () => {
    it("Should allow to get one's groups", async () => {
      const { status } = await request(app)
        .get(`/v2/users/self/groups/`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("POST /v2/groups/:group_id/groups/", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .post(`/v2/groups/${group_id}/groups/`)
        .send({ group_id: subgroup_id })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("GET /v2/groups/:group_id/groups/", () => {
    it("Should allow the query of subgroups", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/${group_id}/groups/`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("GET /v2/groups/:group_id/parents/", () => {
    it("Should allow querying parents of a group", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/${group_id}/parents/`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("GET /v2/groups/:group_id/administrators", () => {
    it("Should allow querying the administrators of a group", async () => {
      const { status } = await request(app)
        .get(`/v2/groups/${group_id}/administrators`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("POST /v2/groups/:group_id/administrators", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .post(`/v2/groups/${group_id}/administrators`)
        .send({ user_id: user._id })
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("DELETE /v2/groups/:group_id/administrators/:administrator_id", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .delete(`/v2/groups/${group_id}/administrators/${user._id}`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("GET /v2/administrators/:user_id/groups", () => {
    it("Should allow querying groups administrated by a user", async () => {
      const { status } = await request(app)
        .get(`/v2/administrators/self/groups`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(200);
    });
  });

  describe("DELETE /v2/groups/:group_id/groups/:subgroup_id", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .delete(`/v2/groups/${group_id}/groups/${subgroup_id}`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });

  describe("DELETE /v2/groups/:group_id", () => {
    it("Should respond with 410", async () => {
      const { status } = await request(app)
        .delete(`/v2/groups/${group_id}`)
        .set("Authorization", `Bearer ${jwt}`);

      expect(status).to.equal(410);
    });
  });
});
