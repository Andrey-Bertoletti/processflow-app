import { test, expect } from "@playwright/test";

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run this flow");

test.describe("critical pipeline flow", () => {
  test("user logs in, reaches kanban and creates a lead", async ({ page }) => {
    await page.goto("/auth/login");

    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

    await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "qa@processflow.local");
    await page.getByLabel("Senha").fill(process.env.E2E_PASSWORD ?? "processflow123");
    await page.getByRole("button", { name: /Entrar/i }).click();

    await page.waitForURL(/auth\/workspace\/create|auth\/dashboard/);

    if (page.url().includes("/auth/workspace/create")) {
      await page.getByLabel("Nome do workspace").fill("QA Workspace");
      await page.getByRole("button", { name: /Criar Workspace/i }).click();
      await page.waitForURL(/auth\/dashboard/);
    }

    await page.getByRole("button", { name: /Abrir Funil/i }).click();
    await page.waitForURL(/pipeline/);

    await expect(page.getByRole("heading", { name: /Funil de Leads/i })).toBeVisible();
    await page.getByRole("button", { name: /Novo Lead/i }).click();
    await expect(page.getByRole("heading", { name: /Novo Lead/i })).toBeVisible();

    await page.getByLabel("Nome do Lead/Processo").fill("Lead QA E2E");
    await page.getByRole("button", { name: /Salvar Lead/i }).click();

    await expect(page.getByText("Lead QA E2E")).toBeVisible();
  });
});
