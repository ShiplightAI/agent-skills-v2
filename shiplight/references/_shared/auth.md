# Shared: Auth

The single source for Shiplight auth, consumed by `verify`, `create-yaml-tests`,
`fix`, and the `auth` subcommand. There are **two execution contexts** — pick by
how the work runs:

- **Browser-session auth** — for the main agent driving an MCP browser session
  ad hoc (`verify`, and walking the app while authoring YAML).
- **Authored-test auth** — for Playwright-executed YAML tests (`create-yaml-tests`,
  `fix`).

Both are recommended defaults, not the only options. If a project already has a
working Playwright-native auth setup (config, setup projects, `use`,
`storageState`), follow it rather than rewriting to match these examples.

Never store raw secrets anywhere — see `_shared/secrets.md`.

## Does a test need auth?

Before writing a test (or a verification flow), determine whether it needs an
authenticated session:

- Does the starting page redirect anonymous visitors to login?
- Do the user actions require an account?

If unclear, infer from app behavior or ask the user. Document the answer in the
spec before writing YAML.

## Browser-session auth (MCP, ad hoc)

For `verify` and app-walking: log in once and save the session so future sessions
skip login.

1. Open a session with `new_session` at the app's login page.
2. Ask the user to switch to the browser and log in manually; wait for them to
   confirm.
3. Call `save_storage_state` to persist cookies + localStorage to
   `~/.shiplight/<site_url>/storage-state.json`
   (e.g. `~/.shiplight/http_localhost_3000/storage-state.json`).
4. For future sessions, pass that path as `storage_state_path` to `new_session`.

If a saved state already exists, use it automatically. If auth fails with a saved
state (redirects to login, console auth errors), it's likely expired — ask the
user to log in again and re-save.

## Authored-test auth (Playwright)

Start with one of two patterns.

### Shared account (most common)

Use when the whole run can share one identity. Create a Playwright setup project
that logs in once, saves `storageState`, and make the main project depend on it.

```ts
// auth.setup.ts
import { test as setup } from "@playwright/test";

setup("login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.USERNAME!);
  await page.getByLabel("Password").fill(process.env.PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: ".auth/default.json" });
});
```

```ts
// playwright.config.ts
export default defineConfig({
  ...shiplightConfig(),
  projects: [
    { name: "auth", testMatch: "auth.setup.ts" },
    {
      name: "default",
      dependencies: ["auth"],
      use: {
        baseURL: "https://staging.example.com",
        storageState: ".auth/default.json",
      },
    },
  ],
});
```

- Tests don't declare an auth block under shared auth — they inherit the
  authenticated `storageState`.
- If the shared account varies by environment or role, select it at runtime with
  env vars rather than per-test auth blocks.

### Per-test auth (advanced)

Use only when different tests in the same run must log in as different users. Each
test declares its auth script and optional args inline; the script exports
`login(args)`, performs login, manages `storageState` caching, and returns the
state-file path.

```ts
// auth.login.ts
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export async function login(args: Record<string, unknown>): Promise<string> {
  const stateFile = path.join(".auth", `${args.username}.json`);
  if (fs.existsSync(stateFile)) return stateFile;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByLabel("Email").fill(args.username as string);
  await page.getByLabel("Password").fill(args.password as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  await context.storageState({ path: stateFile, indexedDB: true });
  await browser.close();
  return stateFile;
}
```

```yaml
use:
  account:
    auth: ./auth.login.ts
    args:
      username: admin@example.com
      password: "{{ADMIN_PASSWORD}}"
goal: Admin can manage users
statements:
  - URL: /admin/users
  - VERIFY: User management page is visible
```

- The `args` object is passed directly to `login(args)` and may carry usernames,
  passwords, TOTP secrets, org IDs, API tokens, etc.
- The auth script owns caching/expiration for `.auth/*`.
- Tests without `use.account.auth` use the default context (inheriting shared
  `storageState` if configured, else unauthenticated).
- Credentials come from the environment, passed as templated placeholders — never
  a raw value in `args`. See `_shared/secrets.md`.

## Agent login helpers

The test fixture's `agent` exposes login helpers, usable from a `js:` statement or
an auth script. Prefer declarative auth above for ordinary suites; reach for these
when a login flow is dynamic enough that AI navigation beats a hardcoded selector
script.

- `agent.login(page, { url, username, password, totpSecret? }): Promise<boolean>`
  — navigates to `url`, fills fields, handles 2FA when `totpSecret` is supplied,
  verifies, returns `true` on success.
- `agent.generate2faCode(secret): Promise<string>` — current 6-digit TOTP code;
  only for a **custom** multi-step login (`agent.login()` already handles TOTP
  when given `totpSecret`).

```js
const ok = await agent.login(page, {
  url: "/login",
  username: process.env.ADMIN_USER,
  password: process.env.ADMIN_PASSWORD,
  totpSecret: process.env.ADMIN_TOTP_SECRET, // optional, for 2FA
});
if (!ok) throw new Error("login failed");
```

> Inside YAML, the same capability is the `generate_2fa_code` action, which stores
> the result in `$otp_code`; see `npx shiplight spec actions`.

## File placement

Don't assume auth files must live under `auth/`. Common choices:

- `playwright.config.ts` (root) — shared auth via setup projects or default `storageState`
- `auth.setup.ts` (root) — shared-account setup
- `auth.login.ts` (root) — per-test auth
- `auth/*.login.ts` — several reusable auth helpers

Reuse existing auth files before creating new ones.

## Account & secret documentation

Store durable account-role facts in `specs/context.md` or `knowledge/`: which auth
pattern the project uses, which roles exist, which tests need which roles, and
which env vars must be present in `.env`. Never commit the actual secret values.
