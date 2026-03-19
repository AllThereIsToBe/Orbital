import { createReadStream } from "node:fs";

const MAX_JSON_BODY_BYTES = 30 * 1024 * 1024;

const createHttpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

export const readJsonBody = async (request) => {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw createHttpError(
        413,
        "Request body too large. The current limit is 30 MB."
      );
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createHttpError(400, "Invalid JSON body.");
  }
};

export const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  });
  response.end(JSON.stringify(payload));
};

export const sendFile = (response, statusCode, path, mime) =>
  new Promise((resolve, reject) => {
    response.writeHead(statusCode, {
      "Content-Type": mime,
      "Access-Control-Allow-Origin": "*"
    });

    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(response);
  });

export const ok = (response, payload) => sendJson(response, 200, payload);
export const created = (response, payload) => sendJson(response, 201, payload);
export const badRequest = (response, message) => sendJson(response, 400, { error: message });
export const unauthorized = (response) => sendJson(response, 401, { error: "Unauthorized." });
export const notFound = (response, message = "Not found.") => sendJson(response, 404, { error: message });

export const withCors = (response) => {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  });
  response.end();
};
