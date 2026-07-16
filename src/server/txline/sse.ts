// Reads a Server Sent Events stream from a fetch Response.
//
// The TxLINE score and odds streams are plain SSE. Each message is a block of
// lines separated by a blank line. A line looks like "field: value". We care
// about id, event, data, and retry. The data lines are JSON that the caller
// parses.

export interface SseMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

// Turns a streaming response body into a series of SSE messages.
export async function* readSseMessages(
  response: Response,
): AsyncGenerator<SseMessage> {
  if (!response.body) throw new Error("Response has no body to stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Messages are separated by a blank line. Split on that and keep the last
      // partial chunk in the buffer for the next read.
      let split = buffer.indexOf("\n\n");
      while (split !== -1) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const message = parseBlock(block);
        if (message) yield message;
        split = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): SseMessage | null {
  const message: SseMessage = { data: "" };
  const dataLines: string[] = [];
  let hasField = false;

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line === "" || line.startsWith(":")) continue; // blank or comment

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // A single space after the colon is part of the format and is stripped.
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    switch (field) {
      case "id":
        message.id = value;
        hasField = true;
        break;
      case "event":
        message.event = value;
        hasField = true;
        break;
      case "data":
        dataLines.push(value);
        hasField = true;
        break;
      case "retry": {
        const ms = Number(value);
        if (Number.isFinite(ms)) message.retry = ms;
        hasField = true;
        break;
      }
      default:
        break;
    }
  }

  if (!hasField) return null;
  message.data = dataLines.join("\n");
  return message;
}
