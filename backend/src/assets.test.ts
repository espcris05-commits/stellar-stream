import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

describe("Assets API Configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should respect ALLOWED_ASSETS environment variable override and normalize", async () => {
    vi.stubEnv("ALLOWED_ASSETS", "yusd, euRo, testCoin ");
    
    // Dynamically import app so it picks up the stubbed environment variable
    const { app } = await import("./index");
    
    const response = await request(app).get("/api/assets");
    
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(["YUSD", "EURO", "TESTCOIN"]);
  });
});
