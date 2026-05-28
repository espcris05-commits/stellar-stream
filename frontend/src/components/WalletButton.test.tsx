import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletButton } from './WalletButton';
import type { FreighterState } from '../hooks/useFreighter';

const MOCK_ADDRESS = 'GBX5ZID6H4G365G7O4W6U4E6U4E6U4E6U4E6U4E6U4E6U4E6U4E6U4E';
const TRUNCATED_ADDRESS = 'GBX5…6U4E';

describe('WalletButton Component', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Disconnected state', () => {
    it('renders "Connect Wallet" button when wallet is installed but not connected', () => {
      const wallet: FreighterState = {
        installed: true,
        allowed: false,
        address: null,
        status: 'idle',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const connectButton = screen.getByRole('button', { name: /Connect Wallet/i });
      expect(connectButton).toBeInTheDocument();
      expect(connectButton).not.toBeDisabled();
      expect(connectButton).toHaveAttribute('title', 'Connect your Freighter wallet');
    });

    it('renders "Install Freighter" button when wallet is not installed', () => {
      const wallet: FreighterState = {
        installed: false,
        allowed: false,
        address: null,
        status: 'idle',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const installButton = screen.getByRole('button', { name: /Install Freighter/i });
      expect(installButton).toBeInTheDocument();
      expect(installButton).not.toBeDisabled();
      expect(installButton).toHaveAttribute('title', 'Freighter extension not detected — install it from freighter.app');
    });

    it('displays error message when present', () => {
      const errorMessage = 'Connection failed';
      const wallet: FreighterState = {
        installed: true,
        allowed: false,
        address: null,
        status: 'error',
        error: errorMessage,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });
  });

  describe('Connecting state', () => {
    it('renders disabled "Connecting…" button during connection', () => {
      const wallet: FreighterState = {
        installed: true,
        allowed: false,
        address: null,
        status: 'connecting',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const connectingButton = screen.getByRole('button', { name: /Connecting…/i });
      expect(connectingButton).toBeInTheDocument();
      expect(connectingButton).toBeDisabled();
      expect(connectingButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Connected state', () => {
    it('displays truncated wallet address when connected', () => {
      const wallet: FreighterState = {
        installed: true,
        allowed: true,
        address: MOCK_ADDRESS,
        status: 'connected',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const addressElement = screen.getByText(TRUNCATED_ADDRESS);
      expect(addressElement).toBeInTheDocument();
      expect(addressElement).toHaveAttribute('title', MOCK_ADDRESS);
    });

    it('shows connected status dot', () => {
      const wallet: FreighterState = {
        installed: true,
        allowed: true,
        address: MOCK_ADDRESS,
        status: 'connected',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      const { container } = render(<WalletButton wallet={wallet} />);
      
      const statusDot = container.querySelector('.wallet-dot--connected');
      expect(statusDot).toBeInTheDocument();
      expect(statusDot).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders disconnect button when connected', () => {
      const wallet: FreighterState = {
        installed: true,
        allowed: true,
        address: MOCK_ADDRESS,
        status: 'connected',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const disconnectButton = screen.getByRole('button', { name: /Disconnect/i });
      expect(disconnectButton).toBeInTheDocument();
      expect(disconnectButton).not.toBeDisabled();
    });

    it('calls disconnect when disconnect button is clicked', async () => {
      const user = userEvent.setup();
      const wallet: FreighterState = {
        installed: true,
        allowed: true,
        address: MOCK_ADDRESS,
        status: 'connected',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const disconnectButton = screen.getByRole('button', { name: /Disconnect/i });
      await user.click(disconnectButton);
      
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connect flow', () => {
    it('calls connect when connect button is clicked', async () => {
      const user = userEvent.setup();
      const wallet: FreighterState = {
        installed: true,
        allowed: false,
        address: null,
        status: 'idle',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const connectButton = screen.getByRole('button', { name: /Connect Wallet/i });
      await user.click(connectButton);
      
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('calls connect when install button is clicked (even if not installed)', async () => {
      const user = userEvent.setup();
      const wallet: FreighterState = {
        installed: false,
        allowed: false,
        address: null,
        status: 'idle',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const installButton = screen.getByRole('button', { name: /Install Freighter/i });
      await user.click(installButton);
      
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Address truncation', () => {
    it('correctly truncates long Stellar addresses', () => {
      const longAddress = 'GBX5ZID6H4G365G7O4W6U4E6U4E6U4E6U4E6U4E6U4E6U4E6U4E6U4E';
      const expectedTruncated = 'GBX5…6U4E';
      
      const wallet: FreighterState = {
        installed: true,
        allowed: true,
        address: longAddress,
        status: 'connected',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      expect(screen.getByText(expectedTruncated)).toBeInTheDocument();
    });

    it('handles edge case with very short address', () => {
      const shortAddress = 'GBX5ZID6';
      const expectedTruncated = 'GBX5…ZID6';
      
      const wallet: FreighterState = {
        installed: true,
        allowed: true,
        address: shortAddress,
        status: 'connected',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      expect(screen.getByText(expectedTruncated)).toBeInTheDocument();
    });
  });

  describe('Not installed state', () => {
    it('shows install guidance in button title', () => {
      const wallet: FreighterState = {
        installed: false,
        allowed: false,
        address: null,
        status: 'idle',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const installButton = screen.getByRole('button', { name: /Install Freighter/i });
      expect(installButton).toHaveAttribute('title', 'Freighter extension not detected — install it from freighter.app');
    });

    it('renders install button with correct styling', () => {
      const wallet: FreighterState = {
        installed: false,
        allowed: false,
        address: null,
        status: 'idle',
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
      };

      render(<WalletButton wallet={wallet} />);
      
      const installButton = screen.getByRole('button', { name: /Install Freighter/i });
      expect(installButton).toHaveClass('btn-primary', 'wallet-btn');
    });
  });
});
