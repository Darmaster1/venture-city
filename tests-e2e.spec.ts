import { test, expect } from "@playwright/test";
test("board loads", async ({ page }) => {
  await page.goto("/board");
  await expect(page.getByText("City Board")).toBeVisible();
});
test("bank desk requires sign in", async ({ page }) => {
  await page.goto("/bank");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Your badge is your ticket.")).toBeVisible();
});
