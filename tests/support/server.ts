import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

export const TEST_PORT = 3100;
export const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess: ChildProcess | null = null;

async function waitForServer(url: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // Server chưa nhận kết nối — thử lại.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server thử nghiệm không sẵn sàng sau ${timeoutMs}ms`);
}

/** Spawn `next dev` trên cổng riêng cho test — dùng dev mode để không phụ
 * thuộc việc đã build sẵn hay chưa. */
export async function startTestServer(): Promise<void> {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

  serverProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(TEST_PORT)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
  });

  await waitForServer(`${BASE_URL}/login`, 60_000);
}

export function stopTestServer() {
  serverProcess?.kill();
  serverProcess = null;
}
