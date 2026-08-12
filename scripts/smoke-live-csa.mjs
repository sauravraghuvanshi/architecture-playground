const baseUrl = process.env.LIVE_BASE_URL?.replace(/\/+$/, "");
const username = process.env.APP_AUTH_USERNAME;
const password = process.env.APP_AUTH_PASSWORD;

if (!baseUrl || !username || !password) {
  throw new Error("LIVE_BASE_URL, APP_AUTH_USERNAME, and APP_AUTH_PASSWORD are required.");
}

async function waitForCurrentRelease(cookie) {
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/ai/status`, {
      headers: { Cookie: cookie },
    });
    if (response.ok) {
      const status = await response.json();
      if (status.architectureImageReview === true) return;
    }
    if (attempt === 18) {
      throw new Error(
        `Current multimodal release did not become active; status returned ${response.status}.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

function sessionCookie(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/(?:^|,\s*)diagrammatic_session=([^;]+)/);
  if (!match) throw new Error("Login response did not issue the session cookie.");
  return `diagrammatic_session=${match[1]}`;
}

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label} returned ${response.status}; expected ${expected}. ${body.slice(0, 200)}`);
  }
}

const anonymousWorkspace = await fetch(`${baseUrl}/diagrammatic`, { redirect: "manual" });
await expectStatus(anonymousWorkspace, 307, "Anonymous workspace");
const anonymousLocation = anonymousWorkspace.headers.get("location") ?? "";
if (!anonymousLocation.startsWith("/login?next=")) {
  throw new Error(`Anonymous workspace redirected to unexpected location: ${anonymousLocation}`);
}

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
await expectStatus(login, 200, "Login");
const cookie = sessionCookie(login);
const authenticatedHeaders = { Cookie: cookie };
await waitForCurrentRelease(cookie);

const workspace = await fetch(`${baseUrl}/diagrammatic`, {
  headers: authenticatedHeaders,
  redirect: "manual",
});
await expectStatus(workspace, 200, "Authenticated workspace");

const aiStatus = await fetch(`${baseUrl}/api/ai/status`, {
  headers: authenticatedHeaders,
});
await expectStatus(aiStatus, 200, "AI status");
const aiCapabilities = await aiStatus.json();

if (aiCapabilities.diagramConfigured) {
  const imageReview = await fetch(`${baseUrl}/api/ai/review`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "image",
      description:
        "Live smoke evidence: Azure Front Door routes to App Service and Azure SQL. Treat missing details as assumptions.",
      image: {
        name: "live-smoke-architecture.png",
        mimeType: "image/png",
        dataUrl:
          "data:image/png;base64,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",
      },
    }),
  });
  await expectStatus(imageReview, 200, "Multimodal architecture review");
  const imageReviewResult = await imageReview.json();
  if (
    typeof imageReviewResult.review?.score !== "number" ||
    !Array.isArray(imageReviewResult.review?.findings) ||
    imageReviewResult.review.findings.length === 0
  ) {
    throw new Error("Multimodal architecture review returned an invalid result.");
  }
}

const templateResponse = await fetch(`${baseUrl}/api/deploy/template`, {
  method: "POST",
  headers: {
    ...authenticatedHeaders,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    payload: {
      nodes: [
        {
          id: "live-smoke-web",
          kind: "icon",
          label: "Live Smoke Web App",
          iconId: "azure/app-services/app-service",
        },
      ],
      edges: [],
    },
  }),
});
await expectStatus(templateResponse, 200, "Deployment handoff");
const handoff = await templateResponse.json();
if (
  typeof handoff.portalUrl !== "string" ||
  !handoff.portalUrl.startsWith("https://portal.azure.com/#create/Microsoft.Template/uri/")
) {
  throw new Error("Deployment handoff returned an invalid Azure Portal URL.");
}

const encodedTemplateUrl = handoff.portalUrl.split("/uri/")[1];
const templateUrl = decodeURIComponent(encodedTemplateUrl);
const publicTemplate = await fetch(templateUrl);
await expectStatus(publicTemplate, 200, "Public short-lived template");
const templateText = await publicTemplate.text();
if (!templateText.includes("Microsoft.Web/sites")) {
  throw new Error("Public short-lived template does not include the mapped App Service resource.");
}
if (/administratorLoginPassword|password/i.test(templateText)) {
  throw new Error("Public short-lived template contains a credential-like field.");
}

const logout = await fetch(`${baseUrl}/api/auth/logout`, {
  method: "POST",
  headers: authenticatedHeaders,
});
await expectStatus(logout, 200, "Logout");

console.log(
  "Live CSA API smoke passed: auth gate, workspace, AI status, multimodal review, deployment handoff, public template, and logout."
);
