import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// End-to-end tests run the production build against the real Flask backend and a
// throwaway SQLite database. Requires `npm run build` and the backend virtualenv.
const port = 5055;
const database = join(mkdtempSync(join(tmpdir(), "mining-risk-e2e-")), "e2e.db");
const python = process.env.PYTHON ?? "../backend/.venv/bin/python";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `${python} -m flask --app wsgi run --port ${port}`,
    cwd: "../backend",
    url: `http://127.0.0.1:${port}/api/health`,
    env: { DATABASE_PATH: database, FRONTEND_DIST: "../frontend/dist", LOG_LEVEL: "WARNING" },
    reuseExistingServer: false,
  },
});
