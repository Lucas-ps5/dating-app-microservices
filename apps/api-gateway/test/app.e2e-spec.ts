import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { App } from "supertest/types";

interface HealthPayload {
  status?: string;
  timestamp?: string;
}

describe("AppController (e2e)", () => {
  let app: INestApplication;

  const httpServer = (): App => app.getHttpServer() as App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [(await import("./../src/app.module")).AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("/ (GET) is public", () => {
    return request(httpServer()).get("/").expect(200).expect("Hello World!");
  });

  it("/health (GET) reports ok", () => {
    return request(httpServer())
      .get("/health")
      .expect(200)
      .expect((res) => {
        const body = res.body as HealthPayload;
        expect(body.status).toBe("ok");
        expect(typeof body.timestamp).toBe("string");
      });
  });

  it("/profile (GET) rejects an unauthenticated caller", () => {
    return request(httpServer()).get("/profile").expect(401);
  });

  it("/admin (GET) rejects an unauthenticated caller", () => {
    return request(httpServer()).get("/admin").expect(401);
  });

  it("/unknown-service (GET) is not found", () => {
    return request(httpServer()).get("/unknown-service/thing").expect(404);
  });
});
