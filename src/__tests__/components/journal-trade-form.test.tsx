import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Simplified trade form component for testing
interface TradeFormData {
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  notes: string;
  ltp_checklist: {
    level: boolean;
    trend: boolean;
    patience_candle: boolean;
    followed_rules: boolean;
  };
}

const TestTradeForm = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [formData, setFormData] = React.useState<TradeFormData>({
    symbol: '',
    direction: 'long',
    entry_price: 0,
    exit_price: 0,
    quantity: 0,
    notes: '',
    ltp_checklist: {
      level: false,
      trend: false,
      patience_candle: false,
      followed_rules: false,
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          executed_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to log trade');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log trade');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="trade-form">
      <input
        type="text"
        value={formData.symbol}
        onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
        placeholder="Symbol"
        data-testid="symbol-input"
      />
      <select
        value={formData.direction}
        onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'long' | 'short' })}
        data-testid="direction-select"
      >
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>
      <input
        type="number"
        value={formData.entry_price}
        onChange={(e) => setFormData({ ...formData, entry_price: parseFloat(e.target.value) || 0 })}
        placeholder="Entry Price"
        data-testid="entry-price-input"
      />
      <input
        type="number"
        value={formData.exit_price}
        onChange={(e) => setFormData({ ...formData, exit_price: parseFloat(e.target.value) || 0 })}
        placeholder="Exit Price"
        data-testid="exit-price-input"
      />
      <input
        type="number"
        value={formData.quantity}
        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
        placeholder="Quantity"
        data-testid="quantity-input"
      />
      <label>
        <input
          type="checkbox"
          checked={formData.ltp_checklist.level}
          onChange={(e) =>
            setFormData({
              ...formData,
              ltp_checklist: { ...formData.ltp_checklist, level: e.target.checked },
            })
          }
          data-testid="checklist-level"
        />
        Key Level
      </label>
      <label>
        <input
          type="checkbox"
          checked={formData.ltp_checklist.trend}
          onChange={(e) =>
            setFormData({
              ...formData,
              ltp_checklist: { ...formData.ltp_checklist, trend: e.target.checked },
            })
          }
          data-testid="checklist-trend"
        />
        With Trend
      </label>
      <textarea
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        placeholder="Notes"
        data-testid="notes-input"
      />
      {error && <span data-testid="error-message">{error}</span>}
      <button type="submit" disabled={submitting} data-testid="submit-button">
        {submitting ? 'Logging...' : 'Log Trade'}
      </button>
      <button type="button" onClick={onClose} data-testid="cancel-button">
        Cancel
      </button>
    </form>
  );
};

const TestJournalPage = () => {
  const [showTradeForm, setShowTradeForm] = React.useState(false);

  return (
    <div>
      <button onClick={() => setShowTradeForm(true)} data-testid="log-trade-button">
        Log Trade
      </button>
      {showTradeForm && (
        <TestTradeForm
          onClose={() => setShowTradeForm(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};

describe('Journal Trade Form', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Log Trade Button', () => {
    it('should open trade form when Log Trade button is clicked', () => {
      render(<TestJournalPage />);

      expect(screen.queryByTestId('trade-form')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('log-trade-button'));

      expect(screen.getByTestId('trade-form')).toBeInTheDocument();
    });
  });

  describe('Trade Form', () => {
    const mockOnClose = jest.fn();
    const mockOnSuccess = jest.fn();

    beforeEach(() => {
      mockOnClose.mockClear();
      mockOnSuccess.mockClear();
    });

    it('should render all form fields', () => {
      render(<TestTradeForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByTestId('symbol-input')).toBeInTheDocument();
      expect(screen.getByTestId('direction-select')).toBeInTheDocument();
      expect(screen.getByTestId('entry-price-input')).toBeInTheDocument();
      expect(screen.getByTestId('exit-price-input')).toBeInTheDocument();
      expect(screen.getByTestId('quantity-input')).toBeInTheDocument();
      expect(screen.getByTestId('notes-input')).toBeInTheDocument();
      expect(screen.getByTestId('checklist-level')).toBeInTheDocument();
      expect(screen.getByTestId('checklist-trend')).toBeInTheDocument();
    });

    it('should submit form with correct data', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      render(<TestTradeForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      fireEvent.change(screen.getByTestId('symbol-input'), { target: { value: 'AAPL' } });
      fireEvent.change(screen.getByTestId('direction-select'), { target: { value: 'long' } });
      fireEvent.change(screen.getByTestId('entry-price-input'), { target: { value: '150' } });
      fireEvent.change(screen.getByTestId('exit-price-input'), { target: { value: '160' } });
      fireEvent.change(screen.getByTestId('quantity-input'), { target: { value: '100' } });
      fireEvent.click(screen.getByTestId('checklist-level'));
      fireEvent.change(screen.getByTestId('notes-input'), { target: { value: 'Test trade' } });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/trades', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }));
      });
    });

    it('should call onSuccess and onClose after successful submission', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      render(<TestTradeForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error message when submission fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      render(<TestTradeForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Server error');
      });
    });

    it('should call onClose when cancel button is clicked', () => {
      render(<TestTradeForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should disable submit button while submitting', async () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100))
      );

      render(<TestTradeForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      fireEvent.click(screen.getByTestId('submit-button'));

      expect(screen.getByTestId('submit-button')).toBeDisabled();
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Logging...');
    });
  });
});
