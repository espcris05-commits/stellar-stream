import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Keypair, Networks, WebAuth } from "@stellar/stellar-sdk";
import jwt from "jsonwebtoken";

const TEST_JWT_SECRET = "test_jwt_secret_multisig";

// Must stub env before importing the module under test
vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
vi.stubEnv("NETWORK_PASSPHRASE", Networks.TESTNET);
vi.stubEnv("DOMAIN", "localhost");

const serverKeypair = Keypair.random();
vi.stubEnv("SERVER_SIGNING_KEY", serverKeypair.secret());

// Import after env stubs are in place
const { verifyChallengeAndIssueToken } = await import("./auth");

function buildSignedChallenge(clientKeypair: Keypair): string {
  const challenge = WebAuth.buildChallengeTx(
    serverKeypair,
    clientKeypair.publicKey(),
    "localhost",
    300,
    Networks.TESTNET,
    "localhost",
  );
  // Sign the challenge with the client keypair
  const { tx } = WebAuth.readChallengeTx(
    challenge,
    serverKeypair.publicKey(),
    Networks.TESTNET,
    "localhost",
    "localhost",
  );
  tx.sign(clientKeypair);
  return tx.toEnvelope().toXDR("base64");
}

describe("verifyChallengeAndIssueToken", () => {
  const clientKeypair = Keypair.random();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("single-signer (standard account)", () => {
    it("issues a JWT without signer_count/threshold when Horizon returns null", async () => {
      // Horizon fetch fails → falls back to single-signer
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

      const signedTx = buildSignedChallenge(clientKeypair);
      const token = await verifyChallengeAndIssueToken(signedTx);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.accountId).toBe(clientKeypair.publicKey());
      expect(decoded.signer_count).toBeUndefined();
      expect(decoded.threshold).toBeUndefined();
    });

    it("issues a JWT without multisig fields when account has only one signer", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            signers: [{ key: clientKeypair.publicKey(), weight: 1, type: "ed25519_public_key" }],
            thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
          }),
        }),
      );

      const signedTx = buildSignedChallenge(clientKeypair);
      const token = await verifyChallengeAndIssueToken(signedTx);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.accountId).toBe(clientKeypair.publicKey());
      expect(decoded.signer_count).toBeUndefined();
      expect(decoded.threshold).toBeUndefined();
    });
  });

  describe("multi-signer (multisig account)", () => {
    const cosigner1 = Keypair.random();
    const cosigner2 = Keypair.random();

    it("issues a JWT with signer_count and threshold for a 2-of-3 multisig account", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            signers: [
              { key: clientKeypair.publicKey(), weight: 1, type: "ed25519_public_key" },
              { key: cosigner1.publicKey(), weight: 1, type: "ed25519_public_key" },
              { key: cosigner2.publicKey(), weight: 1, type: "ed25519_public_key" },
            ],
            thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
          }),
        }),
      );

      // Build challenge and sign with all three signers
      const challenge = WebAuth.buildChallengeTx(
        serverKeypair,
        clientKeypair.publicKey(),
        "localhost",
        300,
        Networks.TESTNET,
        "localhost",
      );
      const { tx } = WebAuth.readChallengeTx(
        challenge,
        serverKeypair.publicKey(),
        Networks.TESTNET,
        "localhost",
        "localhost",
      );
      tx.sign(clientKeypair, cosigner1, cosigner2);
      const signedTx = tx.toEnvelope().toXDR("base64");

      const token = await verifyChallengeAndIssueToken(signedTx);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      expect(decoded.accountId).toBe(clientKeypair.publicKey());
      expect(decoded.signer_count).toBe(3);
      expect(decoded.threshold).toBe(2); // med_threshold
    });

    it("excludes zero-weight signers from signer_count", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            signers: [
              { key: clientKeypair.publicKey(), weight: 1, type: "ed25519_public_key" },
              { key: cosigner1.publicKey(), weight: 1, type: "ed25519_public_key" },
              // weight 0 = revoked signer, should be excluded
              { key: cosigner2.publicKey(), weight: 0, type: "ed25519_public_key" },
            ],
            thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 2 },
          }),
        }),
      );

      const challenge = WebAuth.buildChallengeTx(
        serverKeypair,
        clientKeypair.publicKey(),
        "localhost",
        300,
        Networks.TESTNET,
        "localhost",
      );
      const { tx } = WebAuth.readChallengeTx(
        challenge,
        serverKeypair.publicKey(),
        Networks.TESTNET,
        "localhost",
        "localhost",
      );
      tx.sign(clientKeypair, cosigner1);
      const signedTx = tx.toEnvelope().toXDR("base64");

      const token = await verifyChallengeAndIssueToken(signedTx);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      // 2 active signers (weight > 0) → still multisig, zero-weight signer excluded
      expect(decoded.signer_count).toBe(2);
      expect(decoded.threshold).toBe(1);
    });
  });

  describe("error cases", () => {
    it("throws on a malformed transaction", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
      await expect(verifyChallengeAndIssueToken("not-a-valid-tx")).rejects.toThrow(
        "Challenge verification failed",
      );
    });
  });
});
