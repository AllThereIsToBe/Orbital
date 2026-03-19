const stopwords = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "is",
  "are",
  "be",
  "as",
  "it",
  "that",
  "this",
  "from",
  "into",
  "their",
  "your",
  "was",
  "were"
]);

export const tokenize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));

export const summarizeKeywords = (text, limit = 10) => {
  const counts = new Map();

  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([token]) => token);
};

export const chunkText = (text, maxChars = 1200, overlap = 180) => {
  const clean = text.replace(/\r/g, "").trim();

  if (!clean) {
    return [];
  }

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    const previousStart = start;
    let end = Math.min(clean.length, start + maxChars);

    if (end < clean.length) {
      const nextBreak = clean.lastIndexOf("\n", end);
      const sentenceBreak = clean.lastIndexOf(". ", end);
      end = Math.max(start + 300, nextBreak, sentenceBreak);
    }

    const slice = clean.slice(start, end).trim();

    if (slice) {
      chunks.push({
        index,
        text: slice,
        keywords: summarizeKeywords(slice)
      });
      index += 1;
    }

    if (end >= clean.length) {
      start = clean.length;
    } else {
      start = Math.max(previousStart + 1, end - overlap);
    }
  }

  return chunks;
};

export const rankChunks = (query, rows) => {
  const queryTokens = tokenize(query);
  const querySet = new Set(queryTokens);

  return rows
    .map((row) => {
      const chunkTokens = tokenize(row.text);
      const tokenHits = chunkTokens.reduce(
        (score, token) => score + (querySet.has(token) ? 1 : 0),
        0
      );
      const keywordHits = JSON.parse(row.keywords_json || "[]").reduce(
        (score, keyword) => score + (querySet.has(keyword) ? 2 : 0),
        0
      );

      return {
        ...row,
        score: tokenHits + keywordHits + Math.min(chunkTokens.length / 80, 1)
      };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
};
