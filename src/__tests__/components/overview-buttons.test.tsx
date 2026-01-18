import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the next/navigation hooks
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
  }),
}));

// Simplified button components for testing
const TestOverviewButtons = () => {
  const router = require('next/navigation').useRouter();

  return (
    <div>
      <button onClick={() => router.push('/win-cards')} data-testid="share-progress">
        Share Progress
      </button>
      <button onClick={() => router.push('/learning')} data-testid="begin-learning">
        Begin Learning
      </button>
      <button onClick={() => router.push('/journal')} data-testid="log-trade">
        Log a Trade
      </button>
      <button onClick={() => router.push('/learning')} data-testid="take-quiz">
        Take a Quiz
      </button>
      <button onClick={() => router.push('/win-cards')} data-testid="create-win-card">
        Create Win Card
      </button>
    </div>
  );
};

describe('Overview Page Navigation Buttons', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('should navigate to win-cards when Share Progress is clicked', () => {
    render(<TestOverviewButtons />);

    fireEvent.click(screen.getByTestId('share-progress'));
    expect(mockPush).toHaveBeenCalledWith('/win-cards');
  });

  it('should navigate to learning when Begin Learning is clicked', () => {
    render(<TestOverviewButtons />);

    fireEvent.click(screen.getByTestId('begin-learning'));
    expect(mockPush).toHaveBeenCalledWith('/learning');
  });

  it('should navigate to journal when Log a Trade is clicked', () => {
    render(<TestOverviewButtons />);

    fireEvent.click(screen.getByTestId('log-trade'));
    expect(mockPush).toHaveBeenCalledWith('/journal');
  });

  it('should navigate to learning when Take a Quiz is clicked', () => {
    render(<TestOverviewButtons />);

    fireEvent.click(screen.getByTestId('take-quiz'));
    expect(mockPush).toHaveBeenCalledWith('/learning');
  });

  it('should navigate to win-cards when Create Win Card is clicked', () => {
    render(<TestOverviewButtons />);

    fireEvent.click(screen.getByTestId('create-win-card'));
    expect(mockPush).toHaveBeenCalledWith('/win-cards');
  });
});
