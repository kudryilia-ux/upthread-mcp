import { isAuthorizedSecret, notFound } from "@/lib/gate";
import { createUpthreadHandler } from "@/lib/server";

const handler = createUpthreadHandler();

type Context = { params: Promise<{ secret: string }> };

async function handle(req: Request, { params }: Context): Promise<Response> {
  const { secret } = await params;
  if (!isAuthorizedSecret(secret, process.env.MCP_PATH_SECRET)) return notFound();
  // mcp-handler only serves its own endpoint path (/mcp). Forward on that path,
  // which also keeps the secret out of everything downstream of the gate.
  const url = new URL(req.url);
  url.pathname = "/mcp";
  return handler(new Request(url, req));
}

export { handle as DELETE, handle as GET, handle as OPTIONS, handle as PATCH, handle as POST, handle as PUT };
