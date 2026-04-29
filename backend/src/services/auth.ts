import {
  Keypair,
  Networks,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { sendApiError } from "../apiErrors";

const HORIZON_URL = (process.env.HORIZON_URL || "https://horizon-testnet.stellar.org").trim();

const SERVER_SIGNING_KEY =
  process.env.SERVER_SIGNING_KEY || (process.env.NODE_ENV === 'production' 
    ? ((): string => { throw new Error("SERVER_SIGNING_KEY must be set in production") })() 
    : Keypair.random().secret());

const DOMAIN = (process.env.DOMAIN || "localhost").trim();
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;

let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }

  jwtSecret = crypto.randomBytes(32).toString("hex");

  console.warn(
    "JWT_SECRET not set — using ephemeral secret. All tokens will be invalidated on restart.",
  );
}

export function getJwtSecret() {
  return jwtSecret as string;
}

export interface AuthUser {
  accountId: string;
  signer_count?: number;
  threshold?: number;
}

interface HorizonSigner {
  key: string;
  weight: number;
  type: string;
}

interface HorizonAccountThresholds {
  low_threshold: number;
  med_threshold: number;
  high_threshold: number;
}

interface HorizonAccountResponse {
  signers: HorizonSigner[];
  thresholds: HorizonAccountThresholds;
}

/**
 * Fetches account signers and thresholds from Horizon.
 * Returns null if the account doesn't exist (unfunded) or on network error.
 */
async function fetchAccountSigners(
  accountId: string,
): Promise<{ signers: string[]; threshold: number } | null> {
  try {
    const response = await fetch(`${HORIZON_URL}/accounts/${accountId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as HorizonAccountResponse;
    const signers = data.signers
      .filter((s) => s.weight > 0)
      .map((s) => s.key);
    // Use the medium threshold (required for most operations)
    const threshold = data.thresholds.med_threshold;
    return { signers, threshold };
  } catch {
    return null;
  }
}

export function generateChallenge(accountId: string): string {
  const serverKeypair = Keypair.fromSecret(SERVER_SIGNING_KEY);

  const challenge = WebAuth.buildChallengeTx(
    serverKeypair,
    accountId,
    DOMAIN,
    300, // Valid for 5 minutes
    NETWORK_PASSPHRASE,
    DOMAIN,
  );

  return challenge;
}

/**
 * Verifies a SEP-10 challenge transaction and issues a JWT.
 * Supports both standard single-signer accounts and M-of-N multisig accounts.
 *
 * For multisig accounts, fetches signers from Horizon and passes them all to
 * verifyChallengeTxSigners. The JWT payload includes signer_count and threshold.
 *
 * Rejects if:
 * - Transaction is malformed or not a SEP-10 challenge
 * - Transaction has expired (stale)
 * - Domain/Network doesn't match
 * - Client signature(s) are missing or invalid
 */
export async function verifyChallengeAndIssueToken(
  transactionBase64: string,
): Promise<string> {
  const serverKeypair = Keypair.fromSecret(SERVER_SIGNING_KEY);
  const serverAccountId = serverKeypair.publicKey();

  try {
    // readChallengeTx validates the transaction structure and server signature
    const { clientAccountID } = WebAuth.readChallengeTx(
      transactionBase64,
      serverAccountId,
      NETWORK_PASSPHRASE,
      DOMAIN,
      DOMAIN,
    );

    // Try to fetch account signers from Horizon to detect multisig accounts
    const accountInfo = await fetchAccountSigners(clientAccountID);
    const isMultisig =
      accountInfo !== null && accountInfo.signers.length > 1;

    let signersToVerify: string[];
    if (isMultisig) {
      signersToVerify = accountInfo.signers;
    } else {
      signersToVerify = [clientAccountID];
    }

    // verifyChallengeTxSigners ensures the required signers actually signed it
    const signersFound = WebAuth.verifyChallengeTxSigners(
      transactionBase64,
      serverAccountId,
      NETWORK_PASSPHRASE,
      signersToVerify,
      DOMAIN,
      DOMAIN,
    );

    if (!signersFound || signersFound.length === 0) {
      throw new Error(
        "Challenge transaction verification failed (invalid signature).",
      );
    }

    const payload: AuthUser = { accountId: clientAccountID };
    if (isMultisig && accountInfo) {
      payload.signer_count = accountInfo.signers.length;
      payload.threshold = accountInfo.threshold;
    }

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
    return token;
  } catch (error: any) {
    if (error.message?.includes("TimeBounds")) {
      throw new Error("Challenge has expired. Please request a new one.");
    }
    throw new Error(`Challenge verification failed: ${error.message}`);
  }
}

/**
 * Refreshes a still-valid JWT and returns a new one with a fresh 24h expiry.
 *
 * Accepts the current token in the Authorization header (Bearer scheme).
 * Returns 401 if the token is missing, malformed, or already expired.
 */
export function refreshToken(req: Request, res: Response): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendApiError(req, res, 401, "Missing or invalid authorization header.", {
      code: "UNAUTHORIZED",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;

    const newToken = jwt.sign(
      { accountId: decoded.accountId },
      getJwtSecret(),
      { expiresIn: "24h" },
    );

    res.json({ token: newToken });
  } catch {
    sendApiError(req, res, 401, "Invalid or expired authorization token.", {
      code: "UNAUTHORIZED",
    });
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendApiError(req, res, 401, "Missing or invalid authorization header.", {
      code: "UNAUTHORIZED",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    (req as any).user = decoded; // Attach user to request
    next();
  } catch (error) {
    sendApiError(req, res, 401, "Invalid or expired authorization token.", {
      code: "UNAUTHORIZED",
    });
  }
}
