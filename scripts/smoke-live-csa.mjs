const baseUrl = process.env.LIVE_BASE_URL?.replace(/\/+$/, "");
const username = process.env.APP_AUTH_USERNAME;
const password = process.env.APP_AUTH_PASSWORD;

if (!baseUrl || !username || !password) {
  throw new Error("LIVE_BASE_URL, APP_AUTH_USERNAME, and APP_AUTH_PASSWORD are required.");
}

async function waitForCurrentRelease() {
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/deploy/template?token=invalid`, {
      redirect: "manual",
    });
    if (response.status === 400) return;
    if (attempt === 18) {
      throw new Error(
        `Current release did not become active; deployment template probe returned ${response.status}.`
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

await waitForCurrentRelease();

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
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFAAH/q842AAAAAElFTkSuQmCC",
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
