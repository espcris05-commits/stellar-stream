import { redactObject } from "./logger";

describe("logger redaction", () => {
  test("redacts stellar secret keys in objects and strings", () => {
    const secret = "S" + "A".repeat(55);
    const obj = {
      nested: { secretKey: secret, other: "ok" },
      token: secret,
      arr: [secret, { privateKey: secret }],
    } as const;

    const redacted = redactObject(obj as any);

    expect(redacted.nested.secretKey).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.arr[0]).toBe("[REDACTED]");
    expect(redacted.arr[1].privateKey).toBe("[REDACTED]");
  });
});
