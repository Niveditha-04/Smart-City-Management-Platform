const request = require("supertest");
const { app } = require("../app");

async function makeUser(email, role) {
  await request(app).post("/register").send({ name: role, email, role, password: "pass123" });
  const res = await request(app).post("/login").send({ email, password: "pass123" });
  return res.body.token;
}

describe("Thresholds & roles", () => {
  test("viewer can GET thresholds but cannot PUT", async () => {
    const token = await makeUser("v@test.com", "viewer");

    const get = await request(app).get("/thresholds").set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(Array.isArray(get.body.thresholds)).toBe(true);

    const put = await request(app)
      .put("/thresholds/traffic")
      .set("Authorization", `Bearer ${token}`)
      .send({ warn: 50, critical: 60 });

    expect(put.status).toBe(403);
  });

  test("admin can update thresholds", async () => {
    const token = await makeUser("a@test.com", "admin");

    const put = await request(app)
      .put("/thresholds/traffic")
      .set("Authorization", `Bearer ${token}`)
      .send({ warn: 65, critical: 85 });

    expect(put.status).toBe(200);
    expect(put.body.threshold.metric).toBe("traffic");
    expect(Number(put.body.threshold.warn)).toBe(65);
    expect(Number(put.body.threshold.critical)).toBe(85);
  });
});
