export class RequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(message: string, status: 400 | 413) {
    super(message);
    this.status = status;
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes) throw new RequestBodyError("Request body is too large.", 413);
  if (!request.body) throw new RequestBodyError("Request body is required.", 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("Request body is too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("Request must contain valid JSON.", 400);
  }
}
