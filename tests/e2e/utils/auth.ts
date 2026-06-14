import type { Page } from "@playwright/test";
import { API_URL } from "../fixtures/users";

// The key React's api.ts uses (TOKEN_KEY = "agrored_jwt")
const REACT_TOKEN_KEY = "agrored_jwt";
// Legacy key used by all spec files when reading the token back
const TEST_TOKEN_KEY = "agrored_token";

// Token cache — avoids hitting the auth rate limiter on every beforeEach
const _tokenCache = new Map<string, string>();

export async function loginViaAPI(
  page: Page,
  email: string,
  password: string
): Promise<string> {
  const cached = _tokenCache.get(email);
  if (cached) {
    await page.goto("/login");
    // Set both keys: React reads REACT_TOKEN_KEY, specs read TEST_TOKEN_KEY
    await page.evaluate(
      ([rk, tk, t]) => {
        localStorage.setItem(rk, t);
        localStorage.setItem(tk, t);
      },
      [REACT_TOKEN_KEY, TEST_TOKEN_KEY, cached] as [string, string, string]
    );
    return cached;
  }

  const res = await page.request.post(`${API_URL}/api/v1/users/login`, {
    data: { email, password },
  });
  const body = await res.json();
  const token: string = body.data?.token ?? body.token ?? "";
  if (!token) throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);

  _tokenCache.set(email, token);
  await page.goto("/login");
  await page.evaluate(
    ([rk, tk, t]) => {
      localStorage.setItem(rk, t);
      localStorage.setItem(tk, t);
    },
    [REACT_TOKEN_KEY, TEST_TOKEN_KEY, token] as [string, string, string]
  );
  return token;
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    { timeout: 12_000 }
  );
}

export async function logout(page: Page) {
  await page.evaluate(
    ([rk, tk]) => { localStorage.removeItem(rk); localStorage.removeItem(tk); },
    [REACT_TOKEN_KEY, TEST_TOKEN_KEY] as [string, string]
  );
}
