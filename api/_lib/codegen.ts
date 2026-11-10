/**
 * Secret-code generation and Mastermind-style feedback scoring.
 * Pure functions, server-side only.
 */
import type { GuessResult, SlotFeedback } from '../../src/types/game.js';

/**
 * Generate a secret code.
 * Hard mode => repeats ALLOWED (harder: ambiguous feedback, more combos).
 * Easy (default) => UNIQUE digits only (easier to deduce).
 */
export function generateCode(length: number, hardMode: boolean, existing: number[] = []): number[] {
  // Preserve already-locked / existing leading digits when resizing.
  const digits: number[] = existing.slice(0, length);

  while (digits.length < length) {
    const d = Math.floor(Math.random() * 10);
    // Easy mode enforces uniqueness; hard mode permits repeats.
    if (!hardMode && digits.includes(d)) continue;
    digits.push(d);
  }

  // If shrinking, just truncate (handled by slice above).
  return digits.slice(0, length);
}

/**
 * Score a guess against the secret using standard Mastermind counting
 * with repeats handled correctly:
 *  - A position is `correct` when digit and place match.
 *  - Remaining matched-by-value (not position) digits are `present`.
 *  - Everything else is `absent`.
 */
export function scoreGuess(
  secret: number[],
  guess: number[],
  priorLocked: number[],
  lockCorrect: boolean = true,
): GuessResult {
  const len = secret.length;
  const feedback: SlotFeedback[] = new Array(len).fill('absent');

  // Pass 1: exact matches.
  const secretRemaining: (number | null)[] = secret.slice();
  const guessRemaining: (number | null)[] = guess.slice();

  for (let i = 0; i < len; i++) {
    if (guess[i] === secret[i]) {
      feedback[i] = 'correct';
      secretRemaining[i] = null;
      guessRemaining[i] = null;
    }
  }

  // Pass 2: present-but-misplaced.
  for (let i = 0; i < len; i++) {
    if (guessRemaining[i] === null) continue;
    const g = guessRemaining[i];
    const idx = secretRemaining.findIndex((s) => s !== null && s === g);
    if (idx !== -1) {
      feedback[i] = 'present';
      secretRemaining[idx] = null;
    }
  }

  const correctCount = feedback.filter((f) => f === 'correct').length;
  const presentCount = feedback.filter((f) => f === 'present').length;
  const solved = correctCount === len;

  if (!lockCorrect) {
    // "Think harder" mode: reveal ONLY the counts, never any per-position
    // information. We return an all-'absent' feedback array so the client
    // can't read which slots are correct/present from the network payload,
    // and we never lock anything. (When solved, all slots are correct and
    // the round is over, so it's safe to show green.)
    const hidden: SlotFeedback[] = new Array(len).fill('absent');
    return {
      guess,
      feedback: solved ? feedback : hidden,
      correctCount,
      presentCount,
      lockedPositions: [],
      solved,
      attemptNumber: 0, // filled by caller
    };
  }

  // Lock mode: cumulative locked positions (green). Once locked, always locked.
  const lockedSet = new Set<number>(priorLocked);
  feedback.forEach((f, i) => {
    if (f === 'correct') lockedSet.add(i);
  });
  const lockedPositions = [...lockedSet].sort((a, b) => a - b);

  return {
    guess,
    feedback,
    correctCount,
    presentCount,
    lockedPositions,
    solved,
    attemptNumber: 0, // filled by caller
  };
}

/** Build a math-puzzle hint that never reveals exact digits/positions. */
export function buildHint(secret: number[]): string {
  const sum = secret.reduce((a, b) => a + b, 0);
  const product = secret.reduce((a, b) => a * b, 1);
  const avg = sum / secret.length;
  const even = secret.filter((d) => d % 2 === 0).length;
  const max = Math.max(...secret);
  const min = Math.min(...secret);

  const hints = [
    `The sum of all digits is ${sum}.`,
    `The average of the digits is ${avg.toFixed(2)}.`,
    product === 0
      ? `Multiplying all digits together equals 0 (at least one digit is zero).`
      : `Multiplying all digits together equals ${product}.`,
    `${even} of the digits ${even === 1 ? 'is' : 'are'} even.`,
    `The largest and smallest digit differ by ${max - min}.`,
    `The sum of digits is ${sum % 2 === 0 ? 'even' : 'odd'}.`,
  ];

  return hints[Math.floor(Math.random() * hints.length)];
}
