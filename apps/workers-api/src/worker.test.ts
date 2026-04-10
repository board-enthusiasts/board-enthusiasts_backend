import { describe, expect, it, vi } from "vitest";
import worker, { handleAnalyticsEventRoute, handleMarketingSignupRoute, handleSupportIssueRoute } from "./worker";
import { WorkerAppService, type Env } from "./service-boundary";

const minimalEnv: Env = {
  APP_ENV: "local",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SECRET_KEY: "secret-key",
};

describe("handleMarketingSignupRoute", () => {
  it("returns a created marketing signup response", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      createMarketingSignup: vi.fn().mockResolvedValue({
        accepted: true,
        duplicate: false,
        signup: {
          email: "matt@example.com",
          firstName: "Matt",
          status: "subscribed",
          lifecycleStatus: "waitlisted",
          roleInterests: ["player"],
          source: "landing_page",
          consentedAt: "2026-03-12T18:00:00Z",
          updatedAt: "2026-03-12T18:00:00Z",
        },
      }),
    };

    const response = await handleMarketingSignupRoute(
      new Request("http://example.test/marketing/signups", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://boardenthusiasts.com" },
        body: JSON.stringify({
          email: "matt@example.com",
          firstName: "Matt",
          source: "landing_page",
          consentTextVersion: "landing-page-v1",
          turnstileToken: "token-123",
          roleInterests: ["player"],
        }),
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(201);
    expect(service.createMarketingSignup).toHaveBeenCalledWith(
      {
        email: "matt@example.com",
        firstName: "Matt",
        source: "landing_page",
        consentTextVersion: "landing-page-v1",
        turnstileToken: "token-123",
        roleInterests: ["player"],
      },
      { bypassTurnstile: false },
    );
  });

  it("allows the deploy smoke secret to bypass turnstile verification", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: "smoke-secret",
      }),
      createMarketingSignup: vi.fn().mockResolvedValue({
        accepted: true,
        duplicate: false,
        signup: {
          email: "smoke@example.com",
          firstName: "Smoke",
          status: "subscribed",
          lifecycleStatus: "waitlisted",
          roleInterests: [],
          source: "landing_page",
          consentedAt: "2026-03-12T18:00:00Z",
          updatedAt: "2026-03-12T18:00:00Z",
        },
      }),
    };

    await handleMarketingSignupRoute(
      new Request("http://example.test/marketing/signups", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://boardenthusiasts.com",
          "x-board-enthusiasts-deploy-smoke-secret": "smoke-secret",
        },
        body: JSON.stringify({
          email: "smoke@example.com",
          source: "landing_page",
          consentTextVersion: "landing-page-v1",
        }),
      }),
      service as never,
      {},
    );

    expect(service.createMarketingSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "smoke@example.com",
      }),
      { bypassTurnstile: true },
    );
  });

  it("rejects invalid request bodies", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      createMarketingSignup: vi.fn(),
    };

    await expect(
      handleMarketingSignupRoute(
        new Request("http://example.test/marketing/signups", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://boardenthusiasts.com" },
          body: "{bad-json",
        }),
        service as never,
        {},
      ),
    ).rejects.toMatchObject({
      status: 422,
      payload: {
        errors: {
          body: ["Request body must be valid JSON."],
        },
      },
    });
  });

  it("rejects marketing signups from unapproved origins", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      createMarketingSignup: vi.fn(),
    };

    await expect(
      handleMarketingSignupRoute(
        new Request("http://example.test/marketing/signups", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://evil.example" },
          body: JSON.stringify({
            email: "matt@example.com",
            source: "landing_page",
            consentTextVersion: "landing-page-v1",
          }),
        }),
        service as never,
        {},
      ),
    ).rejects.toMatchObject({
      status: 403,
      payload: {
        code: "marketing_origin_forbidden",
      },
    });
    expect(service.createMarketingSignup).not.toHaveBeenCalled();
  });
});

describe("handleSupportIssueRoute", () => {
  it("accepts an internal support issue report", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      reportSupportIssue: vi.fn().mockResolvedValue({
        accepted: true,
      }),
    };

    const response = await handleSupportIssueRoute(
      new Request("http://example.test/support/issues", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://boardenthusiasts.com" },
        body: JSON.stringify({
          category: "email_signup",
          firstName: "Taylor",
          email: "taylor@example.com",
          pageUrl: "https://boardenthusiasts.com/#signup",
          apiBaseUrl: "https://api.boardenthusiasts.com",
          occurredAt: "2026-03-12T22:30:00Z",
          errorMessage: "We couldn't submit your signup right now.",
          technicalDetails: "Network request failed with a connection error.",
          userAgent: "Vitest Browser",
        }),
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.reportSupportIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "email_signup",
        firstName: "Taylor",
        email: "taylor@example.com",
      }),
      { isDeploySmoke: false },
    );
  });

  it("accepts a BE Home support request", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      reportSupportIssue: vi.fn().mockResolvedValue({
        accepted: true,
      }),
    };

    const response = await handleSupportIssueRoute(
      new Request("http://example.test/support/issues", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://boardenthusiasts.com" },
        body: JSON.stringify({
          category: "be_home_contact",
          firstName: "Taylor",
          email: "taylor@example.com",
          subject: "Support needed",
          description: "The BE Home browser keeps timing out while I am trying to use Contact Us on Board.",
          marketingConsentGranted: true,
          marketingConsentTextVersion: "be-home-support-v1",
          pageUrl: "https://boardenthusiasts.com/support",
          apiBaseUrl: "https://api.boardenthusiasts.com",
          occurredAt: "2026-04-09T22:30:00Z",
          userAgent: "Vitest Browser",
        }),
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.reportSupportIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "be_home_contact",
        firstName: "Taylor",
        email: "taylor@example.com",
        subject: "Support needed",
      }),
      { isDeploySmoke: false },
    );
  });

  it("marks support issue reports as deploy smoke when the shared secret is present", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: "smoke-secret",
      }),
      reportSupportIssue: vi.fn().mockResolvedValue({
        accepted: true,
      }),
    };

    await handleSupportIssueRoute(
      new Request("http://example.test/support/issues", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://boardenthusiasts.com",
          "x-board-enthusiasts-deploy-smoke-secret": "smoke-secret",
        },
        body: JSON.stringify({
          category: "email_signup",
          firstName: "Deploy Smoke",
          email: "deploy-smoke@example.com",
          pageUrl: "https://staging.boardenthusiasts.com",
          apiBaseUrl: "https://api.staging.boardenthusiasts.com",
          occurredAt: "2026-03-14T07:49:44.445613+00:00",
          errorMessage: "Post-deploy smoke validation",
          technicalDetails: "Automated deploy smoke verification",
          userAgent: "board-enthusiasts-dev-cli",
        }),
      }),
      service as never,
      {},
    );

    expect(service.reportSupportIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "email_signup",
        firstName: "Deploy Smoke",
        email: "deploy-smoke@example.com",
      }),
      { isDeploySmoke: true },
    );
  });

  it("rejects support issue reports from unapproved origins", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      reportSupportIssue: vi.fn(),
    };

    await expect(
      handleSupportIssueRoute(
        new Request("http://example.test/support/issues", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://evil.example" },
          body: JSON.stringify({
            category: "email_signup",
            pageUrl: "https://boardenthusiasts.com/#signup",
            apiBaseUrl: "https://api.boardenthusiasts.com",
            occurredAt: "2026-03-12T22:30:00Z",
            errorMessage: "We couldn't submit your signup right now.",
          }),
        }),
        service as never,
        {},
      ),
    ).rejects.toMatchObject({
      status: 403,
      payload: {
        code: "support_issue_origin_forbidden",
      },
    });
    expect(service.reportSupportIssue).not.toHaveBeenCalled();
  });
});

describe("handleAnalyticsEventRoute", () => {
  it("accepts a user-facing analytics event from an approved origin", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      recordAnalyticsEvent: vi.fn().mockResolvedValue({
        accepted: true,
        analyticsEnabled: true,
      }),
    };

    const response = await handleAnalyticsEventRoute(
      new Request("http://example.test/analytics/events", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://boardenthusiasts.com" },
        body: JSON.stringify({
          event: "page_view",
          path: "/browse",
          authState: "anonymous",
          metadata: { isNewVisitor: true },
        }),
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.recordAnalyticsEvent).toHaveBeenCalledWith({
      event: "page_view",
      path: "/browse",
      authState: "anonymous",
      metadata: { isNewVisitor: true },
    });
  });

  it("rejects analytics events from unapproved origins", async () => {
    const service = {
      getContext: vi.fn().mockReturnValue({
        allowedWebOrigins: ["https://boardenthusiasts.com"],
        deploySmokeSecret: null,
      }),
      recordAnalyticsEvent: vi.fn(),
    };

    await expect(
      handleAnalyticsEventRoute(
        new Request("http://example.test/analytics/events", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://evil.example" },
          body: JSON.stringify({
            event: "page_view",
            path: "/browse",
          }),
        }),
        service as never,
        {},
      ),
    ).rejects.toMatchObject({
      status: 403,
      payload: {
        code: "support_issue_origin_forbidden",
      },
    });
    expect(service.recordAnalyticsEvent).not.toHaveBeenCalled();
  });
});

describe("worker public identifier routes", () => {
  it("routes catalog title detail requests with studio and title ids", async () => {
    const getCatalogTitle = vi.spyOn(WorkerAppService.prototype, "getCatalogTitle").mockResolvedValue({
      title: {
        id: "title-1",
        studioId: "studio-1",
        studioSlug: "blue-harbor-games",
        slug: "lantern-drift",
      },
    } as never);

    const response = await worker.fetch(new Request("http://example.test/catalog/studio-1/title-1"), minimalEnv);

    expect(response.status).toBe(200);
    expect(getCatalogTitle).toHaveBeenCalledWith("", "studio-1", "title-1");
  });

  it("routes public studio detail requests with a studio id", async () => {
    const getPublicStudio = vi.spyOn(WorkerAppService.prototype, "getPublicStudio").mockResolvedValue({
      studio: {
        id: "studio-1",
        slug: "blue-harbor-games",
        displayName: "Blue Harbor Games",
      },
    } as never);

    const response = await worker.fetch(new Request("http://example.test/studios/studio-1"), minimalEnv);

    expect(response.status).toBe(200);
    expect(getPublicStudio).toHaveBeenCalledWith("studio-1");
  });
});
