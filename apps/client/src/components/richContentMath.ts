const prefixPattern = /^(\s*(?:>\s*)*(?:(?:[-*+]|\d+\.)\s+)?)?/;
const greekOrMathSymbolPattern = /[α-ωΑ-ΩθϕφωλμνπσΔΩ∂∇√∞≈≤≥→↔]/u;
const proseWordPattern = /[A-Za-z]{5,}/g;

const looseMathTokenPattern =
  /\\[A-Za-z]+(?:\{[^}]+\})?(?:_(?:\{[^}]+\}|[A-Za-z0-9])|\^(?:\{[^}]+\}|[A-Za-z0-9]))*|\b[A-Za-z](?:_(?:\{[^}]+\}|[A-Za-z0-9])|\^(?:\{[^}]+\}|[A-Za-z0-9]))+\b/gu;

const getMarkdownPrefix = (line: string) => line.match(prefixPattern)?.[1] ?? "";

const hasInlineMathDelimiter = (value: string) => value.includes("$");

const normalizeInlineMath = (line: string) =>
  line
    .replace(/\\\[(.+?)\\\]/g, (_match, expression) => `$${String(expression).trim()}$`)
    .replace(/\\\((.+?)\\\)/g, (_match, expression) => `$${String(expression).trim()}$`);

const looksLikeMathSegment = (value: string) => {
  const segment = value.trim();

  if (!segment || hasInlineMathDelimiter(segment)) {
    return false;
  }

  const proseWordCount = segment.match(proseWordPattern)?.length ?? 0;
  const naturalLanguageWordCount = segment.match(/\b[A-Za-z]{2,}\b/gu)?.length ?? 0;
  const hasLooseMathTokens =
    /\\[A-Za-z]+/.test(segment) ||
    /\b[A-Za-z](?:_(?:\{[^}]+\}|[A-Za-z0-9])|\^(?:\{[^}]+\}|[A-Za-z0-9]))+\b/u.test(segment);
  const hasMathSymbols = greekOrMathSymbolPattern.test(segment) || /d\/dt/.test(segment);
  const hasEquation = /(?:^|[\s(])[A-Za-z0-9\\({\[][^=]*=\s*[^=]/u.test(segment);
  const hasOperators = /[+\-*/^]|(?:\b(?:sin|cos|tan|cot|sec|csc|log|ln|exp)\b)/u.test(segment);

  if (!hasEquation && !hasOperators && naturalLanguageWordCount > 1) {
    return false;
  }

  return (
    ((hasLooseMathTokens || hasMathSymbols) && proseWordCount <= 12) ||
    (hasEquation && (hasLooseMathTokens || hasMathSymbols || hasOperators) && proseWordCount <= 10)
  );
};

const wrapInlineMath = (value: string) => {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}$${value.trim()}$${trailing}`;
};

const wrapFormulaClause = (value: string) => {
  if (hasInlineMathDelimiter(value)) {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  const leadingSentenceMatch = trimmed.match(/^([^.!?]+)([.!?]\s+.+)$/u);
  if (leadingSentenceMatch && looksLikeMathSegment(leadingSentenceMatch[1])) {
    return value.replace(leadingSentenceMatch[1], `$${leadingSentenceMatch[1].trim()}$`);
  }

  const explanatoryMatch = trimmed.match(
    /^([^()]+?)(\s*\((?:if|where|since|with|assuming)[^)]+\))([.?!]?)$/iu
  );
  if (explanatoryMatch && looksLikeMathSegment(explanatoryMatch[1])) {
    const [, formula, explanation, punctuation] = explanatoryMatch;
    return wrapInlineMath(formula) + explanation + punctuation;
  }

  const trailingPunctuationMatch = trimmed.match(/^(.+?)([.?!])$/u);
  if (trailingPunctuationMatch && looksLikeMathSegment(trailingPunctuationMatch[1])) {
    return wrapInlineMath(trailingPunctuationMatch[1]) + trailingPunctuationMatch[2];
  }

  if (looksLikeMathSegment(trimmed)) {
    return wrapInlineMath(trimmed);
  }

  return value;
};

const wrapLooseMathTokensOutsideDelimiters = (value: string) =>
  value.replace(looseMathTokenPattern, (token, offset, source) => {
    const start = Number(offset);
    const end = start + token.length;
    const previous = source[start - 1] ?? "";
    const next = source[end] ?? "";

    if (previous === "$" || next === "$") {
      return token;
    }

    return `$${token}$`;
  });

const wrapLooseMathTokens = (value: string) => {
  if (!hasInlineMathDelimiter(value)) {
    return wrapLooseMathTokensOutsideDelimiters(value);
  }

  return value
    .split(/(\${1,2}[^$]+\${1,2})/u)
    .map((segment, index) =>
      index % 2 === 0 ? wrapLooseMathTokensOutsideDelimiters(segment) : segment
    )
    .join("");
};

const normalizeLooseMathLine = (value: string) => {
  if (hasInlineMathDelimiter(value)) {
    return value;
  }

  const parts = value.split(/(:\s+)/u);
  const withFormulaClauses =
    parts.length > 1
      ? parts.map((part, index) => (index > 0 && index % 2 === 0 ? wrapFormulaClause(part) : part)).join("")
      : wrapFormulaClause(value);

  return wrapLooseMathTokens(withFormulaClauses);
};

export const normalizeMathDelimiters = (content: string) => {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const normalized: string[] = [];
  let inDisplayBlock = false;

  for (const line of lines) {
    const prefix = getMarkdownPrefix(line);
    const rest = line.slice(prefix.length);

    if (inDisplayBlock) {
      if (rest.trim() === "\\]") {
        normalized.push(`${prefix}$$`);
        inDisplayBlock = false;
        continue;
      }

      normalized.push(line);
      continue;
    }

    if (rest.trim() === "\\[") {
      normalized.push(`${prefix}$$`);
      inDisplayBlock = true;
      continue;
    }

    normalized.push(`${prefix}${normalizeLooseMathLine(normalizeInlineMath(rest))}`);
  }

  return normalized.join("\n");
};
