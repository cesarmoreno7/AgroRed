import type { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitBtn: Locator;
  readonly errorMsg: Locator;
  readonly forgotLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput    = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitBtn     = page.locator('button[type="submit"]');
    this.errorMsg      = page.locator('p, div').filter({ hasText: /contraseña|credenciales|inválid|error|incorr/i }).first();
    this.forgotLink    = page.locator('a[href="/forgot-password"]');
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitBtn.click();
  }

  async expectRedirectToDashboard() {
    // Wait for navigation away from /login — the dashboard is at "/"
    await this.page.waitForFunction(
      () => !window.location.pathname.startsWith("/login"),
      { timeout: 12_000 }
    );
  }

  async expectError(text?: RegExp | string) {
    if (text) await this.errorMsg.filter({ hasText: text }).waitFor({ timeout: 8_000 });
    else await this.errorMsg.waitFor({ timeout: 8_000 });
  }
}
