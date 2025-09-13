const request = require("supertest");
const { app, db } = require("../app");

async function makeUser(email, role) {
  await request(app).post("/register").send({ name: role, email, role, password: "pass123" });
  const res = await request(app).post("/login").send({ email, password: "pass123" });
  return res.body.token;
}

describe("Auto alert breaches API", () => {
  test("list active breaches and ack with operator", async () => {
    const viewer = await makeUser("v2@test.com", "viewer");
    const operator = await makeUser("op@test.com", "operator");

    await db.query(
      `INSERT INTO alerts_breaches (metric, value, severity, message)
       VALUES ('traffic', 120, 'critical', 'TRAFFIC CRITICAL — value=120, thresholds warn=70, critical=90')`
    );

    // viewer 
    const list = await request(app)
      .get("/alerts/breaches?status=active")
      .set("Authorization", `Bearer ${viewer}`);
    expect(list.status).toBe(200);
    expect(list.body.breaches.length).toBeGreaterThan(0);

    const id = list.body.breaches[0].id;

    // operator 
    const ack = await request(app)
      .post(`/alerts/breaches/${id}/ack`)
      .set("Authorization", `Bearer ${operator}`);
    expect(ack.status).toBe(200);
    expect(ack.body.ok).toBe(true);

    const list2 = await request(app)
      .get("/alerts/breaches?status=active")
      .set("Authorization", `Bearer ${viewer}`);
    const stillActive = (list2.body.breaches || []).find(b => b.id === id);
    expect(stillActive).toBeUndefined();
  });
});
