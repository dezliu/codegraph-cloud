import { serve, type ServerType } from '@hono/node-server';

type ServeOptions = Parameters<typeof serve>[0];

function getServer(globalKey: string): ServerType | undefined {
  return (globalThis as Record<string, unknown>)[globalKey] as ServerType | undefined;
}

function setServer(globalKey: string, server: ServerType): void {
  (globalThis as Record<string, unknown>)[globalKey] = server;
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

export async function releaseHttpServer(globalKey: string): Promise<void> {
  const existing = getServer(globalKey);
  if (!existing) return;
  await closeServer(existing);
  delete (globalThis as Record<string, unknown>)[globalKey];
}

export async function bindHttpServer(
  globalKey: string,
  options: ServeOptions,
  maxAttempts = 15,
): Promise<ServerType> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await releaseHttpServer(globalKey);

    try {
      const server = await new Promise<ServerType>((resolve, reject) => {
        const instance = serve(options);
        instance.once('listening', () => resolve(instance));
        instance.once('error', reject);
      });
      setServer(globalKey, server);
      return server;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EADDRINUSE' && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to bind port ${options.port ?? 3000}`);
}

export function attachHttpServerErrorHandler(
  server: ServerType,
  serviceName: string,
  port: number,
): void {
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[${serviceName}] Port ${port} is already in use. Stop the other process and retry.`);
    } else {
      console.error(`[${serviceName}] Server error:`, err);
    }
    process.exit(1);
  });
}
