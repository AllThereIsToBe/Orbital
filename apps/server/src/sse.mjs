const clients = new Set();

export const attachStream = (request, response) => {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  response.write(`event: ready\ndata: {}\n\n`);
  clients.add(response);

  const keepAlive = setInterval(() => {
    response.write(`event: ping\ndata: {}\n\n`);
  }, 20_000);

  request.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(response);
  });
};

export const broadcast = (event, payload) => {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    client.write(data);
  }
};
