/**
 * KCU Coach - Quiz Data
 * Quizzes for each learning module
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

export interface QuizData {
  id: string;
  moduleId: string;
  moduleSlug: string;
  title: string;
  description: string;
  passingScore: number; // percentage
  timeLimit: number | null; // seconds, null for no limit
  questions: QuizQuestion[];
}

export const QUIZZES: QuizData[] = [
  {
    id: 'quiz_fundamentals',
    moduleId: 'mod_fundamentals',
    moduleSlug: 'fundamentals',
    title: 'Trading Fundamentals Quiz',
    description: 'Test your understanding of trading basics, account types, and chart setup.',
    passingScore: 70,
    timeLimit: 300,
    questions: [
      {
        id: 'fund_q1',
        question: 'What is the main difference between a margin and cash account?',
        options: [
          { id: 'a', text: 'Margin accounts are for options only' },
          { id: 'b', text: 'Margin accounts allow you to borrow money to trade' },
          { id: 'c', text: 'Cash accounts have higher fees' },
          { id: 'd', text: 'There is no difference' },
        ],
        correctOptionId: 'b',
        explanation: 'A margin account allows you to borrow money from your broker to trade, while a cash account requires you to use only your deposited funds.',
      },
      {
        id: 'fund_q2',
        question: 'What is PDT (Pattern Day Trader) rule?',
        options: [
          { id: 'a', text: 'You can only trade 3 stocks per day' },
          { id: 'b', text: 'You need $25,000 minimum to day trade more than 3 times in 5 days in a margin account' },
          { id: 'c', text: 'You must hold positions overnight' },
          { id: 'd', text: 'You can only use market orders' },
        ],
        correctOptionId: 'b',
        explanation: 'The PDT rule requires a minimum of $25,000 in equity to make more than 3 day trades in a 5-day rolling period in a margin account.',
      },
      {
        id: 'fund_q3',
        question: 'What does VWAP stand for?',
        options: [
          { id: 'a', text: 'Volume Weighted Average Price' },
          { id: 'b', text: 'Very Wide Average Position' },
          { id: 'c', text: 'Volatile Weekly Average Price' },
          { id: 'd', text: 'Volume Weighted Annual Price' },
        ],
        correctOptionId: 'a',
        explanation: 'VWAP stands for Volume Weighted Average Price - an important indicator that shows the average price weighted by volume throughout the trading day.',
      },
    ],
  },
  {
    id: 'quiz_ltp_framework',
    moduleId: 'mod_ltp_framework',
    moduleSlug: 'ltp-framework',
    title: 'LTP Framework Quiz',
    description: 'Test your understanding of Levels, Trends, and Patience concepts.',
    passingScore: 70,
    timeLimit: 300,
    questions: [
      {
        id: 'ltp_q1',
        question: 'What does LTP stand for in the KCU trading methodology?',
        options: [
          { id: 'a', text: 'Long Term Profit' },
          { id: 'b', text: 'Levels, Trends, Patience' },
          { id: 'c', text: 'Low Trade Price' },
          { id: 'd', text: 'Limit Trading Position' },
        ],
        correctOptionId: 'b',
        explanation: 'LTP stands for Levels, Trends, and Patience - the three key components that must align for a high-probability trade setup.',
      },
      {
        id: 'ltp_q2',
        question: 'What timeframe is recommended for drawing hourly levels?',
        options: [
          { id: 'a', text: '5-minute chart' },
          { id: 'b', text: '15-minute chart' },
          { id: 'c', text: '60-minute (1-hour) chart' },
          { id: 'd', text: 'Daily chart' },
        ],
        correctOptionId: 'c',
        explanation: 'The 60-minute chart is the preferred timeframe for drawing hourly levels as it provides the best balance of meaningful support/resistance levels.',
      },
      {
        id: 'ltp_q3',
        question: 'What is a "patience candle" in the LTP framework?',
        options: [
          { id: 'a', text: 'A very large bullish candle' },
          { id: 'b', text: 'A small consolidation candle at a key level' },
          { id: 'c', text: 'The first candle of the day' },
          { id: 'd', text: 'A candle that closes at VWAP' },
        ],
        correctOptionId: 'b',
        explanation: 'A patience candle is a small consolidation candle that forms at a key level, showing equilibrium between buyers and sellers before a potential breakout.',
      },
      {
        id: 'ltp_q4',
        question: 'When should you draw your hourly levels?',
        options: [
          { id: 'a', text: 'After market close' },
          { id: 'b', text: 'During market hours' },
          { id: 'c', text: 'Fresh every morning before market open' },
          { id: 'd', text: 'Once a week on Sunday' },
        ],
        correctOptionId: 'c',
        explanation: 'You should draw fresh levels every morning before market open. Never carry over old levels - draw them new each day.',
      },
      {
        id: 'ltp_q5',
        question: 'Where should you place your stop loss when trading a patience candle breakout?',
        options: [
          { id: 'a', text: 'At the previous day low' },
          { id: 'b', text: 'On the other side of the patience candle' },
          { id: 'c', text: 'At VWAP' },
          { id: 'd', text: '2% below entry' },
        ],
        correctOptionId: 'b',
        explanation: 'Your stop loss should be placed on the other side of the patience candle. This gives the trade room to breathe while invalidating the setup if the level fails.',
      },
    ],
  },
  {
    id: 'quiz_price_action',
    moduleId: 'mod_price_action',
    moduleSlug: 'price-action',
    title: 'Price Action Mastery Quiz',
    description: 'Test your understanding of candlesticks and price action analysis.',
    passingScore: 70,
    timeLimit: 300,
    questions: [
      {
        id: 'pa_q1',
        question: 'What does a long lower wick (shadow) on a candle indicate?',
        options: [
          { id: 'a', text: 'Strong selling pressure' },
          { id: 'b', text: 'Buyers stepped in and rejected lower prices' },
          { id: 'c', text: 'The stock is going to gap up tomorrow' },
          { id: 'd', text: 'High volume' },
        ],
        correctOptionId: 'b',
        explanation: 'A long lower wick shows that price went down during the period but buyers pushed it back up, indicating buying pressure and rejection of lower prices.',
      },
      {
        id: 'pa_q2',
        question: 'What is a doji candle?',
        options: [
          { id: 'a', text: 'A candle with a very large body' },
          { id: 'b', text: 'A candle where open and close are nearly the same' },
          { id: 'c', text: 'A green candle that gaps up' },
          { id: 'd', text: 'Two candles that form a pattern' },
        ],
        correctOptionId: 'b',
        explanation: 'A doji is a candle where the open and close prices are nearly identical, showing indecision between buyers and sellers.',
      },
      {
        id: 'pa_q3',
        question: 'What does "bar by bar analysis" focus on?',
        options: [
          { id: 'a', text: 'Only looking at the daily chart' },
          { id: 'b', text: 'Examining each candle individually for clues about buyer/seller strength' },
          { id: 'c', text: 'Counting the number of bars in a trend' },
          { id: 'd', text: 'Using moving average crossovers' },
        ],
        correctOptionId: 'b',
        explanation: 'Bar by bar analysis involves examining each individual candle to understand the story of buyer and seller strength at each moment.',
      },
    ],
  },
  {
    id: 'quiz_psychology',
    moduleId: 'mod_psychology',
    moduleSlug: 'psychology',
    title: 'Trading Psychology Quiz',
    description: 'Test your understanding of trading psychology and emotional control.',
    passingScore: 70,
    timeLimit: 300,
    questions: [
      {
        id: 'psy_q1',
        question: 'What is FOMO in trading?',
        options: [
          { id: 'a', text: 'First Order Market Option' },
          { id: 'b', text: 'Fear of Missing Out - the urge to chase trades' },
          { id: 'c', text: 'A type of chart pattern' },
          { id: 'd', text: 'A risk management strategy' },
        ],
        correctOptionId: 'b',
        explanation: 'FOMO (Fear of Missing Out) is the emotional urge to enter trades impulsively because you\'re afraid of missing a move. It often leads to poor entries.',
      },
      {
        id: 'psy_q2',
        question: 'What should you do after a losing trade?',
        options: [
          { id: 'a', text: 'Immediately take another trade to make back the loss' },
          { id: 'b', text: 'Double your position size on the next trade' },
          { id: 'c', text: 'Review the trade objectively and stick to your plan' },
          { id: 'd', text: 'Stop trading for the rest of the month' },
        ],
        correctOptionId: 'c',
        explanation: 'After a loss, review the trade objectively to learn from it, but don\'t revenge trade or change your strategy emotionally. Stick to your plan.',
      },
      {
        id: 'psy_q3',
        question: 'Why is having a trading plan important?',
        options: [
          { id: 'a', text: 'It guarantees profits' },
          { id: 'b', text: 'It removes emotional decision-making from trading' },
          { id: 'c', text: 'Brokers require it' },
          { id: 'd', text: 'It is not important' },
        ],
        correctOptionId: 'b',
        explanation: 'A trading plan removes emotion from trading decisions. When you have clear rules, you follow them rather than making impulsive decisions based on fear or greed.',
      },
    ],
  },
];

/**
 * Get quiz by ID
 */
export function getQuizById(quizId: string): QuizData | undefined {
  return QUIZZES.find((q) => q.id === quizId);
}

/**
 * Get quiz by module slug
 */
export function getQuizByModuleSlug(moduleSlug: string): QuizData | undefined {
  return QUIZZES.find((q) => q.moduleSlug === moduleSlug);
}

/**
 * Get all quizzes
 */
export function getAllQuizzes(): QuizData[] {
  return QUIZZES;
}
