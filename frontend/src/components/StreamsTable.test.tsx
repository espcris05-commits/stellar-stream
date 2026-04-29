import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StreamsTable } from './StreamsTable'; 
import { Stream } from '../types/stream'; 

const noop = vi.fn();

const mockStreams: Stream[] = [
  {
    id: '1',
    sender: 'G_SENDER',
    recipient: 'G_RECIPIENT123',
    assetCode: 'USDC',
    totalAmount: 100,
    durationSeconds: 3600,
    startAt: 1670000000,
    createdAt: 1670000000,
    progress: {
      status: 'active',
      ratePerSecond: 0.01,
      elapsedSeconds: 100,
      vestedAmount: 20,
      remainingAmount: 80,
      percentComplete: 20,
    },
  },
  {
    id: '2',
    sender: 'G_SENDER',
    recipient: 'G_RECIPIENT123',
    assetCode: 'USDC',
    totalAmount: 100,
    durationSeconds: 3600,
    startAt: 1770000000,
    createdAt: 1670000000,
    progress: {
      status: 'scheduled',
      ratePerSecond: 0.01,
      elapsedSeconds: 0,
      vestedAmount: 0,
      remainingAmount: 100,
      percentComplete: 0,
    },
  },
  {
    id: '3',
    sender: 'G_SENDER',
    recipient: 'G_RECIPIENT123',
    assetCode: 'USDC',
    totalAmount: 100,
    durationSeconds: 3600,
    startAt: 1670000000,
    createdAt: 1670000000,
    progress: {
      status: 'completed',
      ratePerSecond: 0.01,
      elapsedSeconds: 3600,
      vestedAmount: 100,
      remainingAmount: 0,
      percentComplete: 100,
    },
  },
  {
    id: '4',
    sender: 'G_SENDER',
    recipient: 'G_RECIPIENT123',
    assetCode: 'USDC',
    totalAmount: 100,
    durationSeconds: 3600,
    startAt: 1670000000,
    createdAt: 1670000000,
    progress: {
      status: 'canceled',
      ratePerSecond: 0.01,
      elapsedSeconds: 500,
      vestedAmount: 10,
      remainingAmount: 90,
      percentComplete: 10,
    },
  },
];

const defaultProps = {
  streams: mockStreams,
  filters: {},
  onFiltersChange: vi.fn(),
  onCancel: vi.fn().mockResolvedValue(undefined),

};

describe('StreamsTable Component', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders table data when streams are passed', () => {
    render(
      <StreamsTable 

      />
    );
    
    // Checking for text elements populated by the array map
    expect(screen.getAllByTitle('G_RECIPIENT123').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });


  });
});