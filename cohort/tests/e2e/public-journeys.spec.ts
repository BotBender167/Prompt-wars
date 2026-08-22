import { expect, test } from "@playwright/test";

const publicPages = [
  { path: "/", heading: "Discover your Thapar Parivar." },
  { path: "/discover", heading: "Discover" },
  { path: "/discover/live", heading: "Live Now" },
  { path: "/parivar", heading: "Your Parivar" },
];

for (const { path, heading } of publicPages) {
  test(`${path} renders its primary content without browser errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path, { waitUntil: "networkidle" });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("the core journey remains usable at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { level: 1, name: "Discover your Thapar Parivar." })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start discovering" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

test("state-changing API routes reject cross-origin browser requests", async ({
  request,
  baseURL,
}) => {
  const response = await request.put(`${baseURL}/api/profile`, {
    headers: { origin: "https://evil.example" },
    data: { full_name: "ignored" },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toEqual({ error: "Forbidden request origin" });
});
