import { describe, expect, it, vi } from "vitest";
import worker, {
  handleAnalyticsEventRoute,
  handleCreateDeveloperAnalyticsSavedViewRoute,
  handleDeleteDeveloperAnalyticsSavedViewRoute,
  handleDeveloperStudioAnalyticsRoute,
  handleDeveloperTitleAnalyticsRoute,
  handleBeHomeMetricsRoute,
  handleBeHomePresenceEndRoute,
  handleBeHomePresenceRoute,
  handleBeHomeTitleDetailViewRoute,
  handleBeWebsitePresenceRoute,
  handleListDeveloperAnalyticsSavedViewsRoute,
  handleMarketingSignupRoute,
  handleSupportIssueRoute,
  handleUpdateDeveloperAnalyticsSavedViewRoute,
} from "./worker";
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
    expect(service.recordAnalyticsEvent).toHaveBeenCalledWith(
      {
        event: "page_view",
        path: "/browse",
        authState: "anonymous",
        metadata: { isNewVisitor: true },
      },
      {
        countryCode: null,
        ipAddress: null,
      },
    );
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

describe("developer analytics routes", () => {
  it("lists saved analytics views filtered by subject scope", async () => {
    const service = {
      listDeveloperAnalyticsSavedViews: vi.fn().mockResolvedValue({
        views: [],
      }),
    };

    const response = await handleListDeveloperAnalyticsSavedViewsRoute(
      new Request("http://example.test/developer/analytics/views?subjectScope=title", {
        method: "GET",
        headers: { authorization: "Bearer developer-token" },
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(200);
    expect(service.listDeveloperAnalyticsSavedViews).toHaveBeenCalledWith("developer-token", "title");
  });

  it("creates a saved analytics view from the request body", async () => {
    const service = {
      createDeveloperAnalyticsSavedView: vi.fn().mockResolvedValue({
        view: {
          id: "view-1",
        },
      }),
    };

    const response = await handleCreateDeveloperAnalyticsSavedViewRoute(
      new Request("http://example.test/developer/analytics/views", {
        method: "POST",
        headers: {
          authorization: "Bearer developer-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subjectScope: "title",
          name: "Launch watch",
          panels: [
            {
              descriptor: "title_detail_viewed",
              rangePresetId: "last-24-hours",
              customFrom: null,
              customTo: null,
            },
          ],
        }),
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(201);
    expect(service.createDeveloperAnalyticsSavedView).toHaveBeenCalledWith("developer-token", {
      subjectScope: "title",
      name: "Launch watch",
      panels: [
        {
          descriptor: "title_detail_viewed",
          rangePresetId: "last-24-hours",
          customFrom: null,
          customTo: null,
        },
      ],
    });
  });

  it("updates and deletes saved analytics views by id", async () => {
    const service = {
      updateDeveloperAnalyticsSavedView: vi.fn().mockResolvedValue({
        view: {
          id: "view-1",
        },
      }),
      deleteDeveloperAnalyticsSavedView: vi.fn().mockResolvedValue(undefined),
    };

    const updateResponse = await handleUpdateDeveloperAnalyticsSavedViewRoute(
      new Request("http://example.test/developer/analytics/views/view-1", {
        method: "PUT",
        headers: {
          authorization: "Bearer developer-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subjectScope: "studio",
          name: "Followers",
          panels: [
            {
              descriptor: "studio_followed",
              rangePresetId: "today",
              customFrom: null,
              customTo: null,
            },
          ],
        }),
      }),
      "view-1",
      service as never,
      {},
    );

    expect(updateResponse.status).toBe(200);
    expect(service.updateDeveloperAnalyticsSavedView).toHaveBeenCalledWith("developer-token", "view-1", {
      subjectScope: "studio",
      name: "Followers",
      panels: [
        {
          descriptor: "studio_followed",
          rangePresetId: "today",
          customFrom: null,
          customTo: null,
        },
      ],
    });

    const deleteResponse = await handleDeleteDeveloperAnalyticsSavedViewRoute(
      new Request("http://example.test/developer/analytics/views/view-1", {
        method: "DELETE",
        headers: { authorization: "Bearer developer-token" },
      }),
      "view-1",
      service as never,
      {},
    );

    expect(deleteResponse.status).toBe(204);
    expect(service.deleteDeveloperAnalyticsSavedView).toHaveBeenCalledWith("developer-token", "view-1");
  });

  it("passes studio analytics query parameters through to the service", async () => {
    const service = {
      getDeveloperStudioAnalytics: vi.fn().mockResolvedValue({
        range: {
          from: "2026-04-10T00:00:00.000Z",
          to: "2026-04-14T00:00:00.000Z",
        },
        metrics: [],
      }),
    };

    const response = await handleDeveloperStudioAnalyticsRoute(
      new Request("http://example.test/developer/studios/studio-1/analytics?from=2026-04-10T00:00:00Z&to=2026-04-14T00:00:00Z&descriptor=studio_followed", {
        method: "GET",
        headers: { authorization: "Bearer developer-token" },
      }),
      "studio-1",
      service as never,
      {},
    );

    expect(response.status).toBe(200);
    expect(service.getDeveloperStudioAnalytics).toHaveBeenCalledWith("developer-token", "studio-1", {
      from: "2026-04-10T00:00:00Z",
      to: "2026-04-14T00:00:00Z",
      descriptors: ["studio_followed"],
    });
  });

  it("passes title analytics query parameters through to the service", async () => {
    const service = {
      getDeveloperTitleAnalytics: vi.fn().mockResolvedValue({
        range: {
          from: "2026-04-10T00:00:00.000Z",
          to: "2026-04-14T00:00:00.000Z",
        },
        metrics: [],
      }),
    };

    const response = await handleDeveloperTitleAnalyticsRoute(
      new Request("http://example.test/developer/titles/title-1/analytics?descriptor=title_detail_viewed&descriptor=title_get_clicked", {
        method: "GET",
        headers: { authorization: "Bearer developer-token" },
      }),
      "title-1",
      service as never,
      {},
    );

    expect(response.status).toBe(200);
    expect(service.getDeveloperTitleAnalytics).toHaveBeenCalledWith("developer-token", "title-1", {
      from: null,
      to: null,
      descriptors: ["title_detail_viewed", "title_get_clicked"],
    });
  });
});

describe("BE Home internal presence routes", () => {
  it("accepts a BE Home presence heartbeat without a browser origin", async () => {
    const service = {
      upsertBeHomePresenceSession: vi.fn().mockResolvedValue({
        accepted: true,
        session: {
          sessionId: "session-1",
          authState: "anonymous",
          lastSeenAt: "2026-04-10T15:00:00.000Z",
          heartbeatIntervalSeconds: 60,
          activeTtlSeconds: 180,
        },
      }),
    };

    const request = new Request("http://example.test/internal/be-home/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        deviceId: "board-install-1",
        authState: "anonymous",
        deviceIdSource: "install_id",
        clientVersion: "1.0.0",
        appEnvironment: "production",
      }),
    });
    Object.defineProperty(request, "cf", {
      value: { country: "US" },
      configurable: true,
    });

    const response = await handleBeHomePresenceRoute(
      request,
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.upsertBeHomePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "session-1",
        deviceId: "board-install-1",
        authState: "anonymous",
        deviceIdSource: "install_id",
        clientVersion: "1.0.0",
        appEnvironment: "production",
      },
      { countryCode: "US" },
    );
  });

  it("accepts a best-effort BE Home disconnect request", async () => {
    const service = {
      endBeHomePresenceSession: vi.fn().mockResolvedValue({
        accepted: true,
        session: {
          sessionId: "session-1",
          endedAt: "2026-04-10T15:03:00.000Z",
        },
      }),
    };

    const response = await handleBeHomePresenceEndRoute(
      new Request("http://example.test/internal/be-home/presence/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
        }),
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.endBeHomePresenceSession).toHaveBeenCalledWith({
      sessionId: "session-1",
    });
  });

  it("accepts a BE Home title detail view record with native device identity", async () => {
    const service = {
      recordBeHomeTitleDetailView: vi.fn().mockResolvedValue({
        accepted: true,
      }),
    };

    const request = new Request("http://example.test/internal/be-home/title-detail-views", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-be-home-session-id": "session-1",
        "x-be-home-device-id": "board-install-1",
        "x-be-home-device-id-source": "install_id",
        "x-be-home-auth-state": "signed_in",
        "x-be-home-client-version": "1.2.3",
        "x-be-home-app-environment": "production",
      },
      body: JSON.stringify({
        titleId: "title-1",
        studioSlug: "blue-harbor-games",
        titleSlug: "lantern-drift",
        surface: "title-detail",
      }),
    });
    Object.defineProperty(request, "cf", {
      value: { country: "US" },
      configurable: true,
    });

    const response = await handleBeHomeTitleDetailViewRoute(
      request,
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.recordBeHomeTitleDetailView).toHaveBeenCalledWith(
      {
        titleId: "title-1",
        studioSlug: "blue-harbor-games",
        titleSlug: "lantern-drift",
        surface: "title-detail",
      },
      {
        sessionId: "session-1",
        deviceId: "board-install-1",
        deviceIdSource: "install_id",
        authState: "signed_in",
        clientVersion: "1.2.3",
        appEnvironment: "production",
      },
      { countryCode: "US" },
    );
  });

  it("accepts a BE website presence heartbeat without a browser origin", async () => {
    const service = {
      upsertBeWebsitePresenceSession: vi.fn().mockResolvedValue({
        accepted: true,
        session: {
          sessionId: "website-session-1",
          authState: "anonymous",
          lastSeenAt: "2026-04-10T15:00:00.000Z",
          heartbeatIntervalSeconds: 300,
          activeTtlSeconds: 900,
        },
        metrics: {
          activeNowTotal: 1,
          activeNowAnonymous: 1,
          activeNowSignedIn: 0,
          websiteActiveNowTotal: 1,
          websiteActiveNowAnonymous: 1,
          websiteActiveNowSignedIn: 0,
          communityActiveNowTotal: 2,
          totalBoardsSeen: 1,
          dailyActiveDevices: 1,
          weeklyActiveDevices: 1,
          monthlyActiveDevices: 1,
          updatedAt: "2026-04-10T15:00:00.000Z",
        },
      }),
    };

    const request = new Request("http://example.test/internal/be-home/website-presence", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify({
        sessionId: "website-session-1",
        authState: "anonymous",
        pagePath: "/browse",
        appEnvironment: "production",
      }),
    });
    Object.defineProperty(request, "cf", {
      value: { country: "US" },
      configurable: true,
    });

    const response = await handleBeWebsitePresenceRoute(
      request,
      service as never,
      {},
    );

    expect(response.status).toBe(202);
    expect(service.upsertBeWebsitePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "website-session-1",
        authState: "anonymous",
        pagePath: "/browse",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );
  });

  it("returns aggregate BE Home metrics", async () => {
    const service = {
      getBeHomeMetrics: vi.fn().mockResolvedValue({
        metrics: {
          activeNowTotal: 7,
          activeNowAnonymous: 4,
          activeNowSignedIn: 3,
          websiteActiveNowTotal: 5,
          websiteActiveNowAnonymous: 4,
          websiteActiveNowSignedIn: 1,
          communityActiveNowTotal: 12,
          totalBoardsSeen: 21,
          dailyActiveDevices: 9,
          weeklyActiveDevices: 14,
          monthlyActiveDevices: 18,
          updatedAt: "2026-04-10T15:03:00.000Z",
        },
      }),
    };

    const response = await handleBeHomeMetricsRoute(
      new Request("http://example.test/internal/be-home/metrics", {
        method: "GET",
      }),
      service as never,
      {},
    );

    expect(response.status).toBe(200);
    expect(service.getBeHomeMetrics).toHaveBeenCalledOnce();
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

  it("routes BE Home presence heartbeats to the internal presence service", async () => {
    const upsertBeHomePresenceSession = vi.spyOn(WorkerAppService.prototype, "upsertBeHomePresenceSession").mockResolvedValue({
      accepted: true,
      session: {
        sessionId: "session-123",
        authState: "anonymous",
        lastSeenAt: "2026-04-10T15:00:00.000Z",
        heartbeatIntervalSeconds: 60,
        activeTtlSeconds: 180,
      },
    });

    const request = new Request("http://example.test/internal/be-home/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-123",
        deviceId: "install-id-123",
        authState: "anonymous",
      }),
    });
    Object.defineProperty(request, "cf", {
      value: { country: "CA" },
      configurable: true,
    });

    const response = await worker.fetch(request, minimalEnv);

    expect(response.status).toBe(202);
    expect(upsertBeHomePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "session-123",
        deviceId: "install-id-123",
        authState: "anonymous",
      },
      { countryCode: "CA" },
    );
  });

  it("routes BE Home metrics requests to the internal metrics service", async () => {
    const getBeHomeMetrics = vi.spyOn(WorkerAppService.prototype, "getBeHomeMetrics").mockResolvedValue({
      metrics: {
        activeNowTotal: 2,
        activeNowAnonymous: 1,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 3,
        websiteActiveNowAnonymous: 2,
        websiteActiveNowSignedIn: 1,
        communityActiveNowTotal: 5,
        totalBoardsSeen: 11,
        dailyActiveDevices: 5,
        weeklyActiveDevices: 7,
        monthlyActiveDevices: 10,
        updatedAt: "2026-04-10T15:03:00.000Z",
      },
    });

    const response = await worker.fetch(new Request("http://example.test/internal/be-home/metrics"), minimalEnv);

    expect(response.status).toBe(200);
    expect(getBeHomeMetrics).toHaveBeenCalledOnce();
  });

  it("routes BE Home title detail view requests to the internal title analytics service", async () => {
    const touchBeHomePresenceSession = vi.spyOn(WorkerAppService.prototype, "touchBeHomePresenceSession").mockResolvedValue();
    const recordBeHomeTitleDetailView = vi.spyOn(WorkerAppService.prototype, "recordBeHomeTitleDetailView").mockResolvedValue({
      accepted: true,
    });

    const request = new Request("http://example.test/internal/be-home/title-detail-views", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-be-home-session-id": "be-home-session-123",
        "x-be-home-device-id": "install-id-123",
        "x-be-home-device-id-source": "install_id",
        "x-be-home-auth-state": "signed_in",
        "x-be-home-client-version": "1.2.3",
        "x-be-home-app-environment": "production",
      },
      body: JSON.stringify({
        titleId: "title-1",
        studioSlug: "blue-harbor-games",
        titleSlug: "lantern-drift",
        surface: "title-detail",
      }),
    });
    Object.defineProperty(request, "cf", {
      value: { country: "CA" },
      configurable: true,
    });

    const response = await worker.fetch(request, minimalEnv);

    expect(response.status).toBe(202);
    expect(touchBeHomePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "be-home-session-123",
        deviceId: "install-id-123",
        deviceIdSource: "install_id",
        authState: "signed_in",
        clientVersion: "1.2.3",
        appEnvironment: "production",
      },
      { countryCode: "CA" },
    );
    expect(recordBeHomeTitleDetailView).toHaveBeenCalledWith(
      {
        titleId: "title-1",
        studioSlug: "blue-harbor-games",
        titleSlug: "lantern-drift",
        surface: "title-detail",
      },
      {
        sessionId: "be-home-session-123",
        deviceId: "install-id-123",
        deviceIdSource: "install_id",
        authState: "signed_in",
        clientVersion: "1.2.3",
        appEnvironment: "production",
      },
      { countryCode: "CA" },
    );
  });

  it("attaches community metrics headers only when explicitly requested", async () => {
    vi.spyOn(WorkerAppService.prototype, "getBeHomeMetrics").mockResolvedValue({
      metrics: {
        activeNowTotal: 2,
        activeNowAnonymous: 1,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 3,
        websiteActiveNowAnonymous: 2,
        websiteActiveNowSignedIn: 1,
        communityActiveNowTotal: 5,
        totalBoardsSeen: 11,
        dailyActiveDevices: 5,
        weeklyActiveDevices: 7,
        monthlyActiveDevices: 10,
        updatedAt: "2026-04-10T15:03:00.000Z",
      },
    });

    const optedInResponse = await worker.fetch(
      new Request("http://example.test/health/live", {
        headers: {
          "x-be-accept-community-metrics": "1",
        },
      }),
      minimalEnv,
    );
    const defaultResponse = await worker.fetch(new Request("http://example.test/health/live"), minimalEnv);

    expect(optedInResponse.headers.get("x-be-community-active-now-total")).toBe("5");
    expect(optedInResponse.headers.get("access-control-expose-headers")).toContain("x-be-community-active-now-total");
    expect(defaultResponse.headers.get("x-be-community-active-now-total")).toBeNull();
  });

  it("passively records BE Home presence from normal API traffic", async () => {
    const touchBeHomePresenceSession = vi.spyOn(WorkerAppService.prototype, "touchBeHomePresenceSession").mockResolvedValue();
    const getBeHomeMetrics = vi.spyOn(WorkerAppService.prototype, "getBeHomeMetrics").mockResolvedValue({
      metrics: {
        activeNowTotal: 2,
        activeNowAnonymous: 1,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 3,
        websiteActiveNowAnonymous: 2,
        websiteActiveNowSignedIn: 1,
        communityActiveNowTotal: 5,
        totalBoardsSeen: 11,
        dailyActiveDevices: 5,
        weeklyActiveDevices: 7,
        monthlyActiveDevices: 10,
        updatedAt: "2026-04-10T15:03:00.000Z",
      },
    });

    const request = new Request("http://example.test/internal/be-home/metrics", {
      headers: {
        "x-be-home-session-id": "be-home-session-123",
        "x-be-home-device-id": "install-id-123",
        "x-be-home-device-id-source": "install_id",
        "x-be-home-auth-state": "signed_in",
        "x-be-home-client-version": "1.2.3",
        "x-be-home-app-environment": "production",
      },
    });
    Object.defineProperty(request, "cf", {
      value: { country: "CA" },
      configurable: true,
    });

    const response = await worker.fetch(request, minimalEnv);

    expect(response.status).toBe(200);
    expect(touchBeHomePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "be-home-session-123",
        deviceId: "install-id-123",
        deviceIdSource: "install_id",
        authState: "signed_in",
        clientVersion: "1.2.3",
        appEnvironment: "production",
      },
      { countryCode: "CA" },
    );
    expect(getBeHomeMetrics).toHaveBeenCalledOnce();
  });

  it("passively records website presence from normal API traffic", async () => {
    const touchBeWebsitePresenceSession = vi.spyOn(WorkerAppService.prototype, "touchBeWebsitePresenceSession").mockResolvedValue();
    const getBeHomeMetrics = vi.spyOn(WorkerAppService.prototype, "getBeHomeMetrics").mockResolvedValue({
      metrics: {
        activeNowTotal: 2,
        activeNowAnonymous: 1,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 3,
        websiteActiveNowAnonymous: 2,
        websiteActiveNowSignedIn: 1,
        communityActiveNowTotal: 5,
        totalBoardsSeen: 11,
        dailyActiveDevices: 5,
        weeklyActiveDevices: 7,
        monthlyActiveDevices: 10,
        updatedAt: "2026-04-10T15:03:00.000Z",
      },
    });

    const request = new Request("http://example.test/internal/be-home/metrics", {
      headers: {
        "x-be-website-session-id": "website-session-123",
        "x-be-website-auth-state": "anonymous",
        "x-be-page-path": "/browse?sort=featured",
      },
    });
    Object.defineProperty(request, "cf", {
      value: { country: "CA" },
      configurable: true,
    });

    const response = await worker.fetch(request, minimalEnv);

    expect(response.status).toBe(200);
    expect(touchBeWebsitePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "website-session-123",
        authState: "anonymous",
        pagePath: "/browse?sort=featured",
        appEnvironment: null,
      },
      { countryCode: "CA", ipAddress: null },
    );
    expect(getBeHomeMetrics).toHaveBeenCalledOnce();
  });

  it("routes BE website presence heartbeats to the internal presence service", async () => {
    const upsertBeWebsitePresenceSession = vi.spyOn(WorkerAppService.prototype, "upsertBeWebsitePresenceSession").mockResolvedValue({
      accepted: true,
      session: {
        sessionId: "website-session-123",
        authState: "anonymous",
        lastSeenAt: "2026-04-10T15:00:00.000Z",
        heartbeatIntervalSeconds: 300,
        activeTtlSeconds: 900,
      },
      metrics: {
        activeNowTotal: 1,
        activeNowAnonymous: 1,
        activeNowSignedIn: 0,
        websiteActiveNowTotal: 1,
        websiteActiveNowAnonymous: 1,
        websiteActiveNowSignedIn: 0,
        communityActiveNowTotal: 2,
        totalBoardsSeen: 1,
        dailyActiveDevices: 1,
        weeklyActiveDevices: 1,
        monthlyActiveDevices: 1,
        updatedAt: "2026-04-10T15:00:00.000Z",
      },
    });

    const request = new Request("http://example.test/internal/be-home/website-presence", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify({
        sessionId: "website-session-123",
        authState: "anonymous",
        pagePath: "/browse?sort=featured",
      }),
    });
    Object.defineProperty(request, "cf", {
      value: { country: "CA" },
      configurable: true,
    });

    const response = await worker.fetch(request, minimalEnv);

    expect(response.status).toBe(202);
    expect(upsertBeWebsitePresenceSession).toHaveBeenCalledWith(
      {
        sessionId: "website-session-123",
        authState: "anonymous",
        pagePath: "/browse?sort=featured",
      },
      { countryCode: "CA", ipAddress: "203.0.113.10" },
    );
  });
});
