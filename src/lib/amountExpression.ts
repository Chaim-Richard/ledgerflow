/**
 * BigInt Rational Arithmetic & Amount Expression Evaluator
 * Safely evaluates arithmetic expressions (e.g., "100 / 3 * 2", "(40 + 5) / 3")
 * with exact BigInt rational representation, preventing floating-point drift.
 * Rounds to integer cents using standard half-up rounding.
 */

export const MAX_EXPRESSION_LENGTH = 80;
export const MAX_PARENTHESIS_DEPTH = 12;

interface Rational {
  num: bigint;
  den: bigint;
}

function makeRational(n: bigint, d: bigint = 1n): Rational {
  if (d === 0n) {
    throw new Error('Integrity Violation: Division by zero is not allowed.');
  }
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n < 0n ? -n : n, d);
  return { num: n / g, den: d / g };
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function add(a: Rational, b: Rational): Rational {
  return makeRational(a.num * b.den + b.num * a.den, a.den * b.den);
}

function subtract(a: Rational, b: Rational): Rational {
  return makeRational(a.num * b.den - b.num * a.den, a.den * b.den);
}

function multiply(a: Rational, b: Rational): Rational {
  return makeRational(a.num * b.num, a.den * b.den);
}

function divide(a: Rational, b: Rational): Rational {
  if (b.num === 0n) {
    throw new Error('Integrity Violation: Division by zero is not allowed.');
  }
  return makeRational(a.num * b.den, a.den * b.num);
}

function rationalFromNumberString(s: string): Rational {
  const parts = s.split('.');
  if (parts.length === 1) {
    return makeRational(BigInt(parts[0]));
  }
  if (parts.length === 2) {
    const intPart = parts[0] ? BigInt(parts[0]) : 0n;
    const fracStr = parts[1];
    const den = 10n ** BigInt(fracStr.length);
    const fracPart = BigInt(fracStr);
    const num = (intPart >= 0n ? 1n : -1n) * (BigInt(Math.abs(Number(intPart))) * den + fracPart);
    return makeRational(num, den);
  }
  throw new Error(`Integrity Violation: Invalid decimal format: ${s}`);
}

function roundHalfUpToCents(r: Rational): number {
  // Multiply rational by 100 to get value in cents
  const centsNum = r.num * 100n;
  const den = r.den;

  // Exact integer division with remainder
  const quotient = centsNum / den;
  const remainder = centsNum % den;

  if (remainder === 0n) {
    return Number(quotient);
  }

  // Double remainder compared to denominator for half-up rounding
  const absRemainder2 = (remainder < 0n ? -remainder : remainder) * 2n;
  const isNegative = centsNum < 0n;

  if (absRemainder2 >= den) {
    return Number(isNegative ? quotient - 1n : quotient + 1n);
  }
  return Number(quotient);
}

/**
 * Evaluates an arithmetic expression string into integer cents.
 * Supports +, -, *, /, and parentheses.
 */
export function evaluateAmountExpression(expression: string): number {
  const raw = expression.trim();
  if (!raw) return 0;

  if (raw.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`Integrity Violation: Expression length exceeds maximum allowed (${MAX_EXPRESSION_LENGTH} characters).`);
  }

  // Tokenizer
  let depth = 0;
  for (const ch of raw) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) throw new Error('Integrity Violation: Unmatched closing parenthesis.');
    if (depth > MAX_PARENTHESIS_DEPTH) {
      throw new Error(`Integrity Violation: Parenthesis depth exceeds maximum (${MAX_PARENTHESIS_DEPTH}).`);
    }
  }
  if (depth !== 0) {
    throw new Error('Integrity Violation: Unmatched opening parenthesis.');
  }

  type Token =
    | { type: 'NUM'; value: Rational }
    | { type: 'OP'; value: '+' | '-' | '*' | '/' }
    | { type: 'LPAREN' }
    | { type: 'RPAREN' };

  const tokens: Token[] = [];
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    if (/\d|\./.test(ch)) {
      let numStr = '';
      while (i < raw.length && /[\d.]/.test(raw[i])) {
        numStr += raw[i];
        i++;
      }
      tokens.push({ type: 'NUM', value: rationalFromNumberString(numStr) });
      continue;
    }

    throw new Error(`Integrity Violation: Invalid character in amount expression: '${ch}'`);
  }

  // Parser: Recursive descent
  let cursor = 0;

  function parseExpression(): Rational {
    let node = parseTerm();
    while (cursor < tokens.length) {
      const tok = tokens[cursor];
      if (tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
        cursor++;
        const nextTerm = parseTerm();
        node = tok.value === '+' ? add(node, nextTerm) : subtract(node, nextTerm);
      } else {
        break;
      }
    }
    return node;
  }

  function parseTerm(): Rational {
    let node = parseFactor();
    while (cursor < tokens.length) {
      const tok = tokens[cursor];
      if (tok.type === 'OP' && (tok.value === '*' || tok.value === '/')) {
        cursor++;
        const nextFactor = parseFactor();
        node = tok.value === '*' ? multiply(node, nextFactor) : divide(node, nextFactor);
      } else {
        break;
      }
    }
    return node;
  }

  function parseFactor(): Rational {
    if (cursor >= tokens.length) {
      throw new Error('Integrity Violation: Unexpected end of expression.');
    }
    const tok = tokens[cursor];

    // Unary plus or minus
    if (tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
      cursor++;
      const factor = parseFactor();
      return tok.value === '-' ? makeRational(-factor.num, factor.den) : factor;
    }

    if (tok.type === 'LPAREN') {
      cursor++;
      const res = parseExpression();
      if (cursor >= tokens.length || tokens[cursor].type !== 'RPAREN') {
        throw new Error('Integrity Violation: Missing expected closing parenthesis.');
      }
      cursor++;
      return res;
    }

    if (tok.type === 'NUM') {
      cursor++;
      return tok.value;
    }

    throw new Error('Integrity Violation: Unexpected token in amount expression.');
  }

  const rationalResult = parseExpression();
  if (cursor < tokens.length) {
    throw new Error('Integrity Violation: Unexpected tokens remaining after evaluation.');
  }

  return roundHalfUpToCents(rationalResult);
}
