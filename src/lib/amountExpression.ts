/**
 * MIT License
 *
 * Safe arithmetic expression evaluator for financial amounts.
 * Evaluates expressions like "12.50 + 3.20", "(40 + 5) / 3", "100 / 3 * 2"
 * using exact BigInt rationals to eliminate floating-point drift,
 * returning integer cents rounded half-up.
 *
 * Constraints:
 * - No eval / Function constructor
 * - Max length: 80 characters
 * - Max nesting depth: 12
 * - Explicit division by zero check
 */

interface Rational {
  num: bigint;
  den: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function makeRational(num: bigint, den: bigint): Rational {
  if (den === 0n) {
    throw new Error('Division by zero in amount expression');
  }
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

function add(a: Rational, b: Rational): Rational {
  return makeRational(a.num * b.den + b.num * a.den, a.den * b.den);
}

function sub(a: Rational, b: Rational): Rational {
  return makeRational(a.num * b.den - b.num * a.den, a.den * b.den);
}

function mul(a: Rational, b: Rational): Rational {
  return makeRational(a.num * b.num, a.den * b.den);
}

function div(a: Rational, b: Rational): Rational {
  if (b.num === 0n) {
    throw new Error('Division by zero in amount expression');
  }
  return makeRational(a.num * b.den, a.den * b.num);
}

function parseDecimalToRational(str: string): Rational {
  const parts = str.split('.');
  if (parts.length === 1) {
    return makeRational(BigInt(parts[0]), 1n);
  }
  if (parts.length === 2) {
    const intPart = parts[0] ? BigInt(parts[0]) : 0n;
    const fracStr = parts[1];
    if (fracStr.length === 0) {
      return makeRational(intPart, 1n);
    }
    const den = 10n ** BigInt(fracStr.length);
    const fracPart = BigInt(fracStr);
    const num = (intPart < 0n ? -1n : 1n) * ((intPart < 0n ? -intPart : intPart) * den + fracPart);
    return makeRational(num, den);
  }
  throw new Error(`Invalid decimal number: ${str}`);
}

const MAX_EXPRESSION_LENGTH = 80;
const MAX_PARENTHESIS_DEPTH = 12;

export function evaluateAmountExpression(expr: string): number {
  if (!expr || typeof expr !== 'string') {
    throw new Error('Amount expression cannot be empty');
  }
  const trimmed = expr.trim();
  if (trimmed.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`Amount expression exceeds maximum length of ${MAX_EXPRESSION_LENGTH} characters`);
  }

  // Tokenize
  const tokens: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let hasDot = false;
      while (i < trimmed.length && /[0-9.]/.test(trimmed[i])) {
        if (trimmed[i] === '.') {
          if (hasDot) throw new Error('Invalid number format with multiple decimal points');
          hasDot = true;
        }
        numStr += trimmed[i];
        i++;
      }
      tokens.push(numStr);
      continue;
    }
    throw new Error(`Unexpected character '${ch}' in amount expression`);
  }

  if (tokens.length === 0) {
    throw new Error('Amount expression contains no valid tokens');
  }

  // Recursive descent parser
  let pos = 0;
  let depth = 0;

  function parseExpression(): Rational {
    let result = parseTerm();
    while (pos < tokens.length) {
      const op = tokens[pos];
      if (op === '+') {
        pos++;
        const nextTerm = parseTerm();
        result = add(result, nextTerm);
      } else if (op === '-') {
        pos++;
        const nextTerm = parseTerm();
        result = sub(result, nextTerm);
      } else {
        break;
      }
    }
    return result;
  }

  function parseTerm(): Rational {
    let result = parseFactor();
    while (pos < tokens.length) {
      const op = tokens[pos];
      if (op === '*') {
        pos++;
        const nextFactor = parseFactor();
        result = mul(result, nextFactor);
      } else if (op === '/') {
        pos++;
        const nextFactor = parseFactor();
        result = div(result, nextFactor);
      } else {
        break;
      }
    }
    return result;
  }

  function parseFactor(): Rational {
    if (pos >= tokens.length) {
      throw new Error('Unexpected end of expression');
    }
    const token = tokens[pos];
    // Unary plus
    if (token === '+') {
      pos++;
      return parseFactor();
    }
    // Unary minus
    if (token === '-') {
      pos++;
      const factor = parseFactor();
      return makeRational(-factor.num, factor.den);
    }
    // Parenthesized sub-expression
    if (token === '(') {
      depth++;
      if (depth > MAX_PARENTHESIS_DEPTH) {
        throw new Error(`Parenthesis nesting depth exceeds limit of ${MAX_PARENTHESIS_DEPTH}`);
      }
      pos++;
      const res = parseExpression();
      if (pos >= tokens.length || tokens[pos] !== ')') {
        throw new Error('Unbalanced parenthesis: missing closing bracket');
      }
      pos++;
      depth--;
      return res;
    }
    // Number literal
    if (/^[0-9]/.test(token) || token.startsWith('.')) {
      pos++;
      return parseDecimalToRational(token);
    }
    throw new Error(`Unexpected token '${token}' in expression`);
  }

  const finalRational = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected trailing token '${tokens[pos]}'`);
  }

  // Convert to integer cents: round(finalRational * 100) using half-up
  const centsNum = finalRational.num * 100n;
  const den = finalRational.den;

  const isNeg = centsNum < 0n;
  const absNum = isNeg ? -centsNum : centsNum;

  const quotient = absNum / den;
  const remainder = absNum % den;

  let roundedAbs = quotient;
  // Half-up rounding
  if (remainder * 2n >= den) {
    roundedAbs += 1n;
  }

  const roundedCents = isNeg ? -roundedAbs : roundedAbs;
  return Number(roundedCents);
}
