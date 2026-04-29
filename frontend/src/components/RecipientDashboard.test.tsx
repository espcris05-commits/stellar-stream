/**
 * Integration tests for RecipientDashboard with on-chain claim wiring.
 *
 * Covers:
 * - Renders streams for connected wallet
 * - Claim button present and enabled for active streams
 * - Claim button disabled during pending transaction
 * - Success toast shown after confirmed claim
 * - Error toast shown after failed claim
 * - Claim button disabled when claimable amount is 0
 * - No wallet connected state
 */

import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../server";
import { RecipientDashboard } from "./RecipientDashboard";

// ---------------------------------------------------------------------------
// Mock soroban service so tests don't hit the network
// ---------------------------------------------------------------------------

vi.mock("../services/soroban", () => {
  const mockFn = vi.fn();
  return {
    claimOnChain: mockFn,
    claimStream: mockFn,
    SorobanClaimError: class SorobanClaimError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = "SorobanClaimError";
        this.code = code;
      }
    },
  };
});

import { claimOnChain } from "../services/soroban";
const mockClaimOnChain = claimOnChain as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RECIPIENT = "GRECIPIENT456";

const activeStream = {
  id: "1",
  sender: "GSENDER123",
  recipient: RECIPIENT,
  assetCode: "USDC",
  totalAmount: 1000,
  durationSeconds: 86400,
  startAt: 1700000000,
  createdAt: 1699990000,
  progress: {
    status: "active",
    ratePerSecond: 0.01157,
    elapsedSeconds: 43200,
    vestedAmount: 500,
    remainingAmount: 500,
    percentComplete: 50,
  },
};

const zeroVestedStream = {
  ...activeStream,
  id: "2",
  progress: { ...activeStream.progress, vestedAmount: 0, percentComplete: 0 },
};

function setupRecipientHandler(streams: unknown[]) {
  server.use(
    http.get(`/api/recipients/${RECIPIENT}/streams`, () =>
      HttpResponse.json({ data: streams }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimOnChain.mockResolvedValue({
    result: {
      claimedAmount: 500,
      assetCode: "USDC",
      txHash: "txhash123",
    },
    history: []
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RecipientDashboard", () => {
  it("shows wallet-not-connected state when no address", () => {
    render(<RecipientDashboard recipientAddress={null} />);
    expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument();
  });

  it("shows no-streams state when stream list is empty", async () => {
    setupRecipientHandler([]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() => {
      expect(screen.getByText(/no streams found/i)).toBeInTheDocument();
      expect(screen.getByText(/you have no active or completed streams/i)).toBeInTheDocument();
    });
  });

  it("renders active streams with Claim button showing claimable amount", async () => {
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() => {
      const claimButton = screen.getByLabelText(/claim 500 USDC from stream 1/i);
      expect(claimButton).toBeInTheDocument();
      expect(claimButton).not.toBeDisabled();
      expect(claimButton).toHaveTextContent(/claim 500 USDC/i);
    });
    // The status badge specifically (not the section heading)
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("calls claim API with correct stream ID and amount when claim button is clicked", async () => {
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/claim 500 USDC from stream 1/i));
    });

    expect(mockClaimOnChain).toHaveBeenCalledWith("1", RECIPIENT, 500);
  });

  it("claim button is disabled when vested amount is 0", async () => {
    setupRecipientHandler([zeroVestedStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 0 USDC from stream 2/i)).toBeDisabled(),
    );
  });

  it("claim button is disabled while a claim is pending", async () => {
    // Never resolves — simulates in-flight transaction
    mockClaimOnChain.mockReturnValue(new Promise(() => {}));
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument(),
    );

    act(() => {
      fireEvent.click(screen.getByLabelText(/claim 500 USDC from stream 1/i));
    });

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeDisabled(),
    );
    expect(screen.getByText(/claiming…/i)).toBeInTheDocument();
  });

  it("shows success toast after confirmed claim", async () => {
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument(),
    );

    // Mock successful claim explicitly for this test
    mockClaimOnChain.mockResolvedValueOnce({
      result: {
        claimedAmount: 500,
        assetCode: "USDC",
        txHash: "txhash123",
      },
      history: []
    });

    // Explicitly mock the next call to return the same stream or updated one
    // to avoid potential issues with refreshStreams
    setupRecipientHandler([activeStream]);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/claim 500 USDC from stream 1/i));
    });

    await waitFor(() => {
      const toast = screen.getByRole("status");
      expect(toast).toHaveTextContent(/successfully claimed 500 tokens from stream 1/i);
    }, { timeout: 3000 });
  });

  it("shows error toast when claim fails", async () => {
    const { SorobanClaimError } = await import("../services/soroban");
    mockClaimOnChain.mockRejectedValue(
      new SorobanClaimError("amount exceeds claimable", "INSUFFICIENT_VESTED"),
    );
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/claim 500 USDC from stream 1/i));
    });

    await waitFor(() =>
      expect(screen.getByText(/amount exceeds claimable/i)).toBeInTheDocument(),
    );
  });

  it("does not update local state on failed claim", async () => {
    mockClaimOnChain.mockRejectedValue(new Error("network error"));
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/claim 500 USDC from stream 1/i));
    });

    // Stream should still show original vested amount in the table cell (not optimistically updated)
    await waitFor(() => {
      const vestedCells = screen.getAllByText(/500.*USDC/);
      // At least one cell (the <strong> in the table) should still show 500
      expect(vestedCells.length).toBeGreaterThan(0);
    });
    // Claim button should still show the original amount (not 0)
    expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument();
  });


  it("toast can be dismissed", async () => {
    setupRecipientHandler([activeStream]);
    render(<RecipientDashboard recipientAddress={RECIPIENT} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/claim 500 USDC from stream 1/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/claim 500 USDC from stream 1/i));
    });

    await waitFor(() =>
      expect(screen.getByText(/successfully claimed 500 tokens from stream 1/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText(/successfully claimed 500 tokens from stream 1/i)).not.toBeInTheDocument();
  });
});
