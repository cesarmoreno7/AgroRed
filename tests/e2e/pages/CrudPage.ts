import type { Page, Locator } from "@playwright/test";

/**
 * Generic POM for all CRUD pages (Producers, Offers, Demands, etc.)
 * Each module renders a table + "Nuevo" / "Agregar" button + modal form.
 */
export class CrudPage {
  readonly addButton: Locator;
  readonly tableRows: Locator;
  readonly modalForm: Locator;
  readonly saveBtn: Locator;
  readonly cancelBtn: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;
  readonly searchInput: Locator;

  constructor(private page: Page) {
    this.addButton    = page.locator('button').filter({ hasText: /nuevo|agregar|crear|add|registrar/i }).first();
    this.tableRows    = page.locator("table tbody tr");
    this.modalForm    = page.locator('form, [role="dialog"], .modal').first();
    this.saveBtn      = page.locator('button[type="submit"], button').filter({ hasText: /guardar|crear|registrar|save/i }).last();
    this.cancelBtn    = page.locator('button').filter({ hasText: /cancelar|cerrar|cancel/i }).first();
    this.successToast = page.locator('[class*="success"], [class*="green"]').filter({ hasText: /éxito|guardado|creado|registrado/i }).first();
    this.errorToast   = page.locator('[class*="error"], [class*="red"]').filter({ hasText: /error|fallo|falló/i }).first();
    this.searchInput  = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i]').first();
  }

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async openAddForm() {
    await this.addButton.click();
    await this.modalForm.waitFor({ timeout: 5_000 });
  }

  async fillField(label: RegExp | string, value: string) {
    const field = this.page
      .locator(`input, select, textarea`)
      .filter({ hasText: label })
      .or(
        this.page.locator(`label`)
          .filter({ hasText: label })
          .locator(".. input, .. select, .. textarea")
      )
      .first();
    await field.fill(value);
  }

  async clickSave() {
    await this.saveBtn.click();
  }

  async rowCount(): Promise<number> {
    return this.tableRows.count();
  }

  async getEditButtonForRow(index: number): Promise<Locator> {
    return this.tableRows.nth(index).locator('button').filter({ hasText: /editar|edit/i }).first();
  }

  async getDeleteButtonForRow(index: number): Promise<Locator> {
    return this.tableRows.nth(index).locator('button').filter({ hasText: /eliminar|borrar|delete/i }).first();
  }
}
