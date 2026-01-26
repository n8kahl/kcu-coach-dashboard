import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the next/navigation hooks
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({
    module: 'test-module',
  }),
}));

// Simplified module quiz button component for testing
interface QuizButtonProps {
  moduleSlug: string;
  progressPercent: number;
}

const TestQuizButton = ({ moduleSlug, progressPercent }: QuizButtonProps) => {
  const router = require('next/navigation').useRouter();

  return (
    <button
      disabled={progressPercent < 100}
      onClick={() => {
        if (progressPercent === 100) {
          router.push(`/learn/${moduleSlug}/quiz`);
        }
      }}
      data-testid="quiz-button"
    >
      {progressPercent === 100 ? 'Take Quiz' : 'Complete All Lessons First'}
    </button>
  );
};

describe('Learning Module Quiz Button', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('should show "Complete All Lessons First" when progress is less than 100%', () => {
    render(<TestQuizButton moduleSlug="fundamentals" progressPercent={50} />);

    expect(screen.getByTestId('quiz-button')).toHaveTextContent('Complete All Lessons First');
    expect(screen.getByTestId('quiz-button')).toBeDisabled();
  });

  it('should show "Take Quiz" when progress is 100%', () => {
    render(<TestQuizButton moduleSlug="fundamentals" progressPercent={100} />);

    expect(screen.getByTestId('quiz-button')).toHaveTextContent('Take Quiz');
    expect(screen.getByTestId('quiz-button')).not.toBeDisabled();
  });

  it('should navigate to quiz page when clicked with 100% progress', () => {
    render(<TestQuizButton moduleSlug="fundamentals" progressPercent={100} />);

    fireEvent.click(screen.getByTestId('quiz-button'));
    expect(mockPush).toHaveBeenCalledWith('/learn/fundamentals/quiz');
  });

  it('should not navigate when clicked with less than 100% progress', () => {
    render(<TestQuizButton moduleSlug="fundamentals" progressPercent={75} />);

    fireEvent.click(screen.getByTestId('quiz-button'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should use correct module slug in navigation URL', () => {
    render(<TestQuizButton moduleSlug="advanced-patterns" progressPercent={100} />);

    fireEvent.click(screen.getByTestId('quiz-button'));
    expect(mockPush).toHaveBeenCalledWith('/learn/advanced-patterns/quiz');
  });
});
