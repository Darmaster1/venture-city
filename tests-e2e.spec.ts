import { test, expect } from "@playwright/test";
test("board loads", async ({ page }) => {
  await page.goto("/board");
  await expect(page.getByText("City Board")).toBeVisible();
});
test("bank desk renders", async ({ page }) => {
  await page.goto("/bank");
  await expect(page.getByText("Bank")).toBeVisible();
});
