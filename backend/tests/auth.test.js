const request = require("supertest");
const { app } = require("../app");

describe("Auth", () => {
  test("register + login works", async () => {
    const email = "admin@test.com";

    const reg = await request(app)
      .post("/register")
      .send({ name: "Admin T", email, role: "admin", password: "pass123" });
    expect(reg.status).toBe(200);
    expect(reg.body.user.email).toBe(email);
    expect(reg.body.user.role).toBe("admin");

    const login = await request(app)
      .post("/login")
      .send({ email, password: "pass123" });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
    expect(login.body.user.role).toBe("admin");
  });

  test("login fails with wrong password", async () => {
    const email = "viewer@test.com";

    await request(app)
      .post("/register")
      .send({ name: "View U", email, role: "viewer", password: "okokok" });

    const bad = await request(app)
      .post("/login")
      .send({ email, password: "wrong" });
    expect(bad.status).toBe(401);
  });
});
