import { test, expect, type Page } from "@playwright/test";
const projectId = "123456789012345678901234";
const initialProject = () => ({
  _id: projectId,
  name: "Account Access",
  context: {
    description: "Users can sign in using email and password.",
    additionalContext: "",
  },
  attachments: [] as object[],
  design: {
    category: "Functional",
    technique: "General",
    format: "standard",
    outputTypes: ["testCases", "userStories"],
  },
  workflows: [] as Record<string, unknown>[],
  rules: [] as Record<string, unknown>[],
  userStories: [] as Record<string, unknown>[],
  testCases: [] as Record<string, unknown>[],
  status: "context_added",
  updatedAt: "2026-09-19T12:00:00Z",
  createdAt: "2026-09-19T12:00:00Z",
  generatedAt: "",
});
async function fixture(page: Page, signedIn = true) {
  const project = initialProject();
  if (signedIn)
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "token",
        `test.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`,
      );
      sessionStorage.setItem(
        "user",
        JSON.stringify({
          id: "user",
          name: "Catarina Thomas",
          email: "catarina@example.com",
        }),
      );
    });
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api", "");
    const data = req.headers()["content-type"]?.includes("application/json")
      ? req.postDataJSON() || {}
      : {};
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/auth/login" || path === "/auth/register")
      return json({
        token: `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`,
        user: {
          id: "user",
          name: "Catarina Thomas",
          email: "catarina@example.com",
        },
      });
    if (path === "/auth/logout") return json({ message: "Signed out" });
    if (path === "/projects" && req.method() === "GET")
      return json({ projects: [project], total: 1, page: 1, pages: 1 });
    if (path === "/projects" && req.method() === "POST") {
      project.name = data.name;
      project.context.description = data.description;
      return json({ project }, 201);
    }
    if (path.endsWith("/context/file")) {
      project.attachments.push({
        _id: "file1",
        fileName: "requirement.txt",
        size: 50,
        mimeType: "text/plain",
      });
      return json({ project }, 201);
    }
    if (path.endsWith("/context")) {
      Object.assign(project.context, data);
      return json({ project });
    }
    if (path.endsWith("/design")) {
      project.design = data;
      return json({ project });
    }
    if (path.endsWith("/generate") || path.endsWith("/regenerate")) {
      const base = {
        reviewState: "pending",
        approved: false,
        explicit: false,
        workflowId: "workflow1",
      };
      project.workflows = [
        {
          ...base,
          _id: "workflow1",
          title: "Account access",
          description: "Users sign in to their account with valid credentials.",
        },
      ];
      project.rules = [
        {
          ...base,
          _id: "rule1",
          title: "Require a valid password",
          description: "Access requires a matching email and password.",
        },
      ];
      project.userStories = [
        {
          ...base,
          _id: "story1",
          title: "Sign in to my account",
          description:
            "As a user, I want to sign in so that I can access my account.",
        },
      ];
      project.testCases = ["positive", "negative", "edge", "validation"].map(
        (type, i) => ({
          ...base,
          _id: `case${i}`,
          title: `${type} login scenario`,
          description: "",
          type,
          preconditions: ["An account exists"],
          steps: ["Open login", "Enter credentials", "Submit the form"],
          expectedResult: "The expected access decision is shown.",
        }),
      );
      project.status = "generated";
      project.generatedAt = "2026-09-19T12:00:00Z";
      return json({ project });
    }
    if (path.includes("/items/")) {
      const pieces = path.split("/");
      const kind = pieces[4] as
        "workflows" | "rules" | "userStories" | "testCases";
      if (path.endsWith("/bulk")) {
        if (data.action === "delete")
          project[kind] = project[kind].filter(
            (i) => !data.ids.includes(i._id),
          );
        else
          project[kind].forEach((i) => {
            if (data.ids.includes(i._id)) {
              if (data.action === "explicit") i.explicit = true;
              else {
                i.reviewState =
                  data.action === "approve" ? "approved" : "rejected";
                i.approved = data.action === "approve";
              }
            }
          });
      } else {
        const item = project[kind].find((i) => i._id === pieces[5]);
        Object.assign(item!, data, { reviewState: "pending", approved: false });
      }
      return json({ project });
    }
    if (path.endsWith("/export"))
      return route.fulfill({
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("test-download"),
      });
    return json({ project });
  });
  return project;
}
async function generate(page: Page) {
  await page.goto(`/projects/${projectId}/design`);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Generated Workflows (1)" }),
  ).toBeVisible();
}
test("desktop: input and attachment, preserve context, generate, review, edit, reload and export", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const project = await fixture(page);
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(e.message));
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: /Welcome to the world/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-home.png",
    fullPage: true,
  });
  await page
    .getByLabel("Software requirement")
    .fill("Users can sign in with email and password.");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "requirement.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Lock out after five failed attempts."),
    });
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name").fill("Account Access");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Associate Context" }),
  ).toBeVisible();
  await expect(
    page.getByText("requirement.txt", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Additional context")
    .fill("Display a useful error for invalid credentials.");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Test Design Optimization" }),
  ).toBeVisible();
  expect(project.context.description).toContain("email and password");
  expect(project.context.additionalContext).toContain("useful error");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Generated Workflows (1)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View workflow" }).click();
  await expect(page.locator(".workflow-pane")).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-workflow.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Close workflow", exact: true })
    .click();
  await page.getByRole("button", { name: "4 Test cases" }).click();
  await page
    .getByLabel("Select positive login scenario", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Approve selected", exact: true })
    .click();
  await expect(page.getByText("Review changes saved.")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit positive login scenario", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Valid login with known credentials");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page
      .getByText("Valid login with known credentials", { exact: false })
      .first(),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "4 Test cases" }).click();
  await expect(
    page
      .getByText("Valid login with known credentials", { exact: false })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-results.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "5 Export" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all to Excel" }).click();
  expect((await downloaded).suggestedFilename()).toContain(".xlsx");
  expect(crashes).toEqual([]);
});
test("mobile: responsive pages, recoverable save failure and modal keyboard dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await generate(page);
  await page.getByRole("button", { name: "4 Test cases" }).click();
  await page.screenshot({
    path: "test-results/mobile-results.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Edit positive login scenario", exact: true })
    .click();
  await page.route("**/items/testCases/case0", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Please try again." }),
    }),
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("Please try again");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Generated Testcases (4)" }),
  ).toBeVisible();
  await page.goto(`/projects/${projectId}/context`);
  await page.screenshot({
    path: "test-results/mobile-context.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("signup validation and login remain usable", async ({
  page,
}) => {
  await fixture(page, false);
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Catarina");
  await page.getByLabel("Email address").fill("catarina@example.com");
  await page.getByLabel("Password", { exact: true }).fill("long-password");
  await page.getByLabel("Confirm password").fill("different-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match");
  await page.goto("/login");
  await page.getByLabel("Email address").fill("catarina@example.com");
  await page.getByLabel("Password", { exact: true }).fill("long-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Welcome to the world/ }),
  ).toBeVisible();
});
