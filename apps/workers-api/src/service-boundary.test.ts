import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { canViewerAccessTitleReportMessageAudience, WorkerAppService } from "./service-boundary";

type MarketingContactRow = {
  id: string;
  email: string;
  normalized_email: string;
  first_name: string | null;
  status: "subscribed";
  lifecycle_status: "waitlisted" | "invited" | "converted";
  consented_at: string;
  consent_text_version: string;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  brevo_contact_id: string | null;
  brevo_sync_state: "pending" | "synced" | "skipped" | "failed";
  brevo_synced_at: string | null;
  brevo_last_error: string | null;
  converted_app_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type RoleInterestRow = {
  marketing_contact_id: string;
  role: "player" | "developer";
  created_at: string;
};

type AppUserRow = {
  id: string;
  auth_user_id: string;
  user_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_verified: boolean;
  identity_provider: string | null;
  avatar_url: string | null;
  avatar_storage_path?: string | null;
  brevo_contact_id?: string | null;
  brevo_sync_state?: "pending" | "synced" | "skipped" | "failed";
  brevo_synced_at?: string | null;
  brevo_last_error?: string | null;
  updated_at: string;
};

type AppUserRoleRow = {
  user_id: string;
  role: "player" | "developer" | "verified_developer" | "moderator" | "admin" | "super_admin";
};

type BoardProfileRow = {
  user_id: string;
  board_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  linked_at: string;
  last_synced_at: string;
  updated_at: string;
};

type TitleRow = {
  id: string;
  lifecycle_status: "draft" | "active" | "archived";
  visibility: "unlisted" | "listed";
  updated_at: string;
};

type UserNotificationRow = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

type CatalogMediaEntryRow = {
  id: string;
  studio_id: string | null;
  title_id: string | null;
  media_type_key: string;
  kind: string;
  source_url: string | null;
  storage_path: string | null;
  video_url: string | null;
  alt_text: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type BeHomePresenceSessionRow = {
  session_id: string;
  device_id_hash: string;
  auth_state: "anonymous" | "signed_in";
  surface: "be_home" | "be_website";
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  country_code: string | null;
  client_version: string | null;
  app_environment: string | null;
  device_id_source: string | null;
};

type BeHomeDeviceIdentityRow = {
  device_id_hash: string;
  first_seen_at: string;
  last_seen_at: string;
  first_country_code: string | null;
  last_country_code: string | null;
  last_client_version: string | null;
  last_device_id_source: string | null;
};

type TitleDetailViewRow = {
  title_id: string;
  viewer_hash: string;
  viewer_source: "ip_address" | "visitor_id" | "be_home_device";
  auth_state: "anonymous" | "authenticated";
  studio_slug: string | null;
  title_slug: string | null;
  surface: string | null;
  app_environment: string | null;
  first_viewed_at: string;
  last_viewed_at: string;
  first_country_code: string | null;
  last_country_code: string | null;
};

type WorkerAppServicePrivateTestAccess = {
  getDeveloperTitleDetails(userId: string, titleId: string): Promise<Record<string, unknown>>;
  getUsersByIds(userIds: string[]): Promise<AppUserRow[]>;
};

function asWorkerAppServicePrivateTestAccess(service: WorkerAppService): WorkerAppServicePrivateTestAccess {
  return service as unknown as WorkerAppServicePrivateTestAccess;
}

const tables: {
  marketing_contacts: MarketingContactRow[];
  marketing_contact_role_interests: RoleInterestRow[];
  app_users: AppUserRow[];
  app_user_roles: AppUserRoleRow[];
  user_board_profiles: BoardProfileRow[];
  titles: TitleRow[];
  user_notifications: UserNotificationRow[];
  catalog_media_entries: CatalogMediaEntryRow[];
  be_home_presence_sessions: BeHomePresenceSessionRow[];
  be_home_device_identities: BeHomeDeviceIdentityRow[];
  title_detail_views: TitleDetailViewRow[];
} = {
  marketing_contacts: [],
  marketing_contact_role_interests: [],
  app_users: [],
  app_user_roles: [],
  user_board_profiles: [],
  titles: [],
  user_notifications: [],
  catalog_media_entries: [],
  be_home_presence_sessions: [],
  be_home_device_identities: [],
  title_detail_views: [],
};

function resetTables() {
  tables.marketing_contacts = [];
  tables.marketing_contact_role_interests = [];
  tables.app_users = [];
  tables.app_user_roles = [];
  tables.user_board_profiles = [];
  tables.titles = [];
  tables.user_notifications = [];
  tables.catalog_media_entries = [];
  tables.be_home_presence_sessions = [];
  tables.be_home_device_identities = [];
  tables.title_detail_views = [];
}

const supabaseAuthMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUserById: vi.fn(),
  listUsers: vi.fn(),
  signInWithPassword: vi.fn(),
}));

function createQueryBuilder(tableName: keyof typeof tables) {
  let filters: Array<{ column: string; value: unknown }> = [];
  let inclusionFilters: Array<{ column: string; values: unknown[] }> = [];
  let orderBy: { column: string; ascending: boolean } | null = null;
  let pendingUpdate: Record<string, unknown> | null = null;

  const applyFilters = <TRow extends Record<string, unknown>>(rows: TRow[]) => {
    const filtered = rows.filter(
      (row) =>
        filters.every((filter) => row[filter.column] === filter.value) &&
        inclusionFilters.every((filter) => filter.values.includes(row[filter.column])),
    );

    if (!orderBy) {
      return filtered;
    }

    const order = orderBy;

    return [...filtered].sort((left, right) => {
      const leftValue = left[order.column];
      const rightValue = right[order.column];
      if (leftValue === rightValue) {
        return 0;
      }
      if (leftValue == null) {
        return order.ascending ? -1 : 1;
      }
      if (rightValue == null) {
        return order.ascending ? 1 : -1;
      }
      return order.ascending
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });
  };

  const builder = {
    select(_columns?: string) {
      return builder;
    },
    then(onFulfilled: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
      if (pendingUpdate) {
        for (const row of applyFilters(tables[tableName] as Array<Record<string, unknown>>)) {
          Object.assign(row, pendingUpdate);
        }

        pendingUpdate = null;
      }

      return Promise.resolve({
        data: applyFilters(tables[tableName] as Array<Record<string, unknown>>),
        error: null,
      }).then(onFulfilled, onRejected);
    },
    limit(count: number) {
      return Promise.resolve({
        data: applyFilters(tables[tableName] as Array<Record<string, unknown>>).slice(0, count),
        error: null,
      });
    },
    upsert(payload: Record<string, unknown>, options?: { onConflict?: string }) {
      const rows = tables[tableName] as Array<Record<string, unknown>>;
      const conflictColumn = options?.onConflict ?? "id";
      const match = rows.find((row) => row[conflictColumn] === payload[conflictColumn]);
      if (match) {
        Object.assign(match, payload);
      } else {
        rows.push({ ...payload } as never);
      }
      return builder;
    },
    single() {
      const rows = applyFilters(tables[tableName] as Array<Record<string, unknown>>);
      return Promise.resolve({
        data: (rows[0] ?? (tables[tableName] as Array<Record<string, unknown>>).slice(-1)[0] ?? null),
        error: null,
      });
    },
    eq(column: string, value: unknown) {
      filters = [...filters, { column, value }];
      return builder;
    },
    in(column: string, values: unknown[]) {
      inclusionFilters = [...inclusionFilters, { column, values }];
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      orderBy = { column, ascending: options?.ascending ?? true };
      return builder;
    },
    insert(payload: Array<Record<string, unknown>> | Record<string, unknown>) {
      const rows = Array.isArray(payload) ? payload : [payload];
      (tables[tableName] as Array<Record<string, unknown>>).push(...rows.map((row) => ({ ...row })));
      return builder;
    },
    delete() {
      return {
        eq(column: string, value: unknown) {
          const rows = tables[tableName] as Array<Record<string, unknown>>;
          const kept = rows.filter((row) => row[column] !== value);
          rows.splice(0, rows.length, ...kept);
          return Promise.resolve({ error: null });
        },
      };
    },
    update(payload: Record<string, unknown>) {
      pendingUpdate = payload;
      return builder;
    },
  };

  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from(tableName: keyof typeof tables) {
      return createQueryBuilder(tableName);
    },
    auth: {
      getUser: supabaseAuthMocks.getUser,
      signInWithPassword: supabaseAuthMocks.signInWithPassword,
      admin: {
        updateUserById: supabaseAuthMocks.updateUserById,
        listUsers: supabaseAuthMocks.listUsers,
      },
    },
  })),
}));

describe("WorkerAppService.createMarketingSignup", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("stores waitlisted lifecycle state, role interests, and Brevo attributes for a new signup", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "welcome-1" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
    });

    const response = await service.createMarketingSignup({
      email: "Taylor@example.com",
      firstName: "Taylor",
      source: "landing_page",
      consentTextVersion: "landing-page-v1",
      turnstileToken: "turnstile-token",
      roleInterests: ["player", "developer", "player"],
    });

    expect(response.duplicate).toBe(false);
    expect(response.signup.lifecycleStatus).toBe("waitlisted");
    expect(response.signup.roleInterests).toEqual(["developer", "player"]);
    expect(tables.marketing_contacts[0]).toMatchObject({
      normalized_email: "taylor@example.com",
      lifecycle_status: "waitlisted",
      source: "landing_page",
    });
    expect(tables.marketing_contact_role_interests).toEqual([
      expect.objectContaining({ role: "developer" }),
      expect.objectContaining({ role: "player" }),
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.brevo.com/v3/contacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "Taylor@example.com",
          attributes: {
            FIRSTNAME: "Taylor",
            SOURCE: "landing_page",
            BE_LIFECYCLE_STATUS: "waitlisted",
            BE_ROLE_INTEREST: "developer,player",
          },
          listIds: [12],
          updateEnabled: true,
          emailBlacklisted: false,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"subject\":\"You're on the BE list!\""),
      }),
    );
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
    });
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain("\"name\":\"Taylor\"");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain("\"htmlContent\":\"<!DOCTYPE html>");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain("creating indie content for Board, following new Board games and apps");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain("For Board Players and Builders");
  });

  it("treats unchecked role interests as none for Brevo and an empty application record", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 99 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "welcome-2" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
    });

    const response = await service.createMarketingSignup({
      email: "hello@example.com",
      source: "landing_page",
      consentTextVersion: "landing-page-v1",
      turnstileToken: "turnstile-token",
      roleInterests: [],
    });

    expect(response.signup.roleInterests).toEqual([]);
    expect(tables.marketing_contact_role_interests).toEqual([]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.brevo.com/v3/contacts",
      expect.objectContaining({
        body: expect.stringContaining("\"BE_ROLE_INTEREST\":\"none\""),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        body: expect.stringContaining("\"subject\":\"You're on the BE list!\""),
      }),
    );
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).toContain("\"name\":\"Interested\"");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).not.toContain("developer");
    expect(String(fetchMock.mock.calls[2]?.[1]?.body)).not.toContain("player");
  });

  it("waits for the welcome email delivery attempt before resolving a new signup", async () => {
    let resolveWelcome:
      | ((value: { ok: true; json: () => Promise<{ messageId: string }> }) => void)
      | undefined;
    const welcomeDelivery = new Promise<{ ok: true; json: () => Promise<{ messageId: string }> }>((resolve) => {
      resolveWelcome = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123 }),
      })
      .mockImplementationOnce(() => welcomeDelivery);
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
    });

    let settled = false;
    const responsePromise = service.createMarketingSignup({
      email: "new-welcome@example.com",
      firstName: "Welcome",
      source: "landing_page",
      consentTextVersion: "landing-page-v1",
      turnstileToken: "turnstile-token",
      roleInterests: ["player"],
    }).then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveWelcome?.({
      ok: true,
      json: async () => ({ messageId: "welcome-awaited" }),
    });

    await expect(responsePromise).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("can bypass turnstile verification for deploy smoke signups while still syncing Brevo", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 314 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
      DEPLOY_SMOKE_SECRET: "smoke-secret",
    });

    const response = await service.createMarketingSignup(
      {
        email: "smoke@example.com",
        firstName: "Smoke",
        source: "landing_page",
        consentTextVersion: "landing-page-v1",
        turnstileToken: null,
        roleInterests: ["player"],
      },
      { bypassTurnstile: true },
    );

    expect(response.accepted).toBe(true);
    expect(response.signup.roleInterests).toEqual(["player"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/contacts",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("does not send the welcome email again for duplicate signups", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 77 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "welcome-repeat" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 77 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
    });

    await service.createMarketingSignup({
      email: "repeat@example.com",
      firstName: "Repeat",
      source: "landing_page",
      consentTextVersion: "landing-page-v1",
      turnstileToken: "turnstile-token",
      roleInterests: ["player"],
    });

    await service.createMarketingSignup({
      email: "repeat@example.com",
      firstName: "Repeat",
      source: "landing_page",
      consentTextVersion: "landing-page-v1",
      turnstileToken: "turnstile-token",
      roleInterests: ["player"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://api.brevo.com/v3/smtp/email", expect.any(Object));
    expect(fetchMock).not.toHaveBeenNthCalledWith(5, "https://api.brevo.com/v3/smtp/email", expect.any(Object));
  });

  it("suppresses deploy-smoke support emails in staging", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
      SUPPORT_REPORT_RECIPIENT: "support@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_EMAIL: "noreply@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_NAME: "Board Enthusiasts",
    });

    await expect(
      service.reportSupportIssue(
        {
          category: "email_signup",
          firstName: "Deploy Smoke",
          email: "deploy-smoke@example.com",
          pageUrl: "https://staging.boardenthusiasts.com",
          apiBaseUrl: "https://api.staging.boardenthusiasts.com",
          occurredAt: "2026-03-14T07:49:44.445613+00:00",
          errorMessage: "Post-deploy smoke validation",
          technicalDetails: "Automated deploy smoke verification",
          userAgent: "board-enthusiasts-dev-cli",
        },
        { isDeploySmoke: true },
      ),
    ).resolves.toEqual({ accepted: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("WorkerAppService.reportSupportIssue", () => {
  it("accepts a BE Home support request and forwards the user's reply-to email", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => "",
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
      SUPPORT_REPORT_RECIPIENT: "support@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_EMAIL: "noreply@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_NAME: "Board Enthusiasts",
    });

    await expect(
      service.reportSupportIssue({
        category: "be_home_contact",
        firstName: "Taylor",
        email: "taylor@example.com",
        subject: "Need help with BE Home",
        description: "The Contact Us button is not doing anything on my Board device.",
        marketingConsentGranted: true,
        marketingConsentTextVersion: "be-home-support-v1",
        pageUrl: "https://boardenthusiasts.com/support",
        apiBaseUrl: "https://api.boardenthusiasts.com",
        occurredAt: "2026-04-09T22:30:00Z",
        userAgent: "Vitest Browser",
        language: "en-US",
        timeZone: "America/Chicago",
        viewportWidth: 1280,
        viewportHeight: 720,
        screenWidth: 1280,
        screenHeight: 720,
      }),
    ).resolves.toEqual({ accepted: true });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"subject\":\"[BE Home Support Request] Need help with BE Home\""),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.brevo.com/v3/contacts",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("uses the anonymous BE Home fallback address when no email is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => "",
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
      SUPPORT_REPORT_RECIPIENT: "support@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_EMAIL: "noreply@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_NAME: "Board Enthusiasts",
    });

    await expect(
      service.reportSupportIssue({
        category: "be_home_contact",
        firstName: "Anonymous",
        email: null,
        subject: "Anonymous Board feedback",
        description: "I wanted to stay anonymous but still send a support note from Board.",
        pageUrl: "https://boardenthusiasts.com/support",
        apiBaseUrl: "https://api.boardenthusiasts.com",
        occurredAt: "2026-04-09T22:30:00Z",
      }),
    ).resolves.toEqual({ accepted: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("support+be-home@boardenthusiasts.com"),
      }),
    );
  });

  it("requires a consent text version when a BE Home support request opts into marketing", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      SUPPORT_REPORT_RECIPIENT: "support@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_EMAIL: "noreply@boardenthusiasts.com",
      SUPPORT_REPORT_SENDER_NAME: "Board Enthusiasts",
    });

    await expect(
      service.reportSupportIssue({
        category: "be_home_contact",
        firstName: "Taylor",
        email: "taylor@example.com",
        subject: "Need help",
        description: "Please help.",
        marketingConsentGranted: true,
        pageUrl: "https://boardenthusiasts.com/support",
        apiBaseUrl: "https://api.boardenthusiasts.com",
        occurredAt: "2026-04-09T22:30:00Z",
      }),
    ).rejects.toMatchObject({
      status: 422,
      payload: {
        errors: {
          marketingConsentTextVersion: ["Consent text version is required when marketing consent is granted."],
        },
      },
    });
  });
});

describe("WorkerAppService.getCurrentUserResponse", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("includes the current user's avatar URL when present", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: {
        id: "user-1",
        auth_user_id: "auth-user-1",
        user_name: "ava.garcia",
        display_name: "Ava Garcia",
        first_name: "Ava",
        last_name: "Garcia",
        email: "ava@example.com",
        email_verified: true,
        identity_provider: "email",
        avatar_url: "https://cdn.example.com/avatars/ava.png",
      },
      roles: ["player"],
    });

    await expect(service.getCurrentUserResponse("test-token")).resolves.toEqual({
      subject: "auth-user-1",
      displayName: "Ava Garcia",
      email: "ava@example.com",
      emailVerified: true,
      identityProvider: "email",
      roles: ["player"],
      avatarUrl: "https://cdn.example.com/avatars/ava.png",
    });
  });

  it("syncs auth-owned email fields into the projected profile for existing users", async () => {
    tables.app_users.push({
      id: "user-1",
      auth_user_id: "auth-user-1",
      user_name: "ava.garcia",
      display_name: "Ava Garcia",
      first_name: "Ava",
      last_name: "Garcia",
      email: "old@example.com",
      email_verified: true,
      identity_provider: "email",
      avatar_url: null,
      avatar_storage_path: null,
      updated_at: "2026-03-01T00:00:00Z",
    });

    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "new@example.com",
          email_confirmed_at: null,
          app_metadata: { provider: "email" },
          user_metadata: {},
          identities: [{ provider: "email" }],
        },
      },
      error: null,
    });

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await expect(service.getCurrentUserProfile("test-token")).resolves.toMatchObject({
      profile: {
        subject: "auth-user-1",
        email: "new@example.com",
        emailVerified: false,
      },
    });

    expect(tables.app_users[0]).toMatchObject({
      email: "new@example.com",
      email_verified: false,
    });
  });

  it("leaves first and last name blank when oauth metadata only provides a full name", async () => {
    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "matt@example.com",
          email_confirmed_at: "2026-04-01T00:00:00Z",
          app_metadata: { provider: "github" },
          user_metadata: {
            full_name: "Matt Stroman",
          },
          identities: [{ provider: "github" }],
        },
      },
      error: null,
    });

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await expect(service.getCurrentUserProfile("test-token")).resolves.toMatchObject({
      profile: {
        subject: "auth-user-1",
        displayName: "Matt Stroman",
        firstName: null,
        lastName: null,
        email: "matt@example.com",
        emailVerified: true,
      },
    });

    expect(tables.app_users[0]).toMatchObject({
      auth_user_id: "auth-user-1",
      display_name: "Matt Stroman",
      first_name: null,
      last_name: null,
      email: "matt@example.com",
      email_verified: true,
      identity_provider: "github",
    });
  });

  it("captures an oauth avatar URL from provider metadata when creating the projected user", async () => {
    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "matt@example.com",
          email_confirmed_at: "2026-04-01T00:00:00Z",
          app_metadata: { provider: "discord" },
          user_metadata: {
            full_name: "Matt Stroman",
            avatar_url: "https://cdn.discordapp.com/avatars/123/avatar.png",
          },
          identities: [{ provider: "discord" }],
        },
      },
      error: null,
    });

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await expect(service.getCurrentUserProfile("test-token")).resolves.toMatchObject({
      profile: {
        subject: "auth-user-1",
        avatarUrl: "https://cdn.discordapp.com/avatars/123/avatar.png",
      },
    });

    expect(tables.app_users[0]).toMatchObject({
      auth_user_id: "auth-user-1",
      avatar_url: "https://cdn.discordapp.com/avatars/123/avatar.png",
      identity_provider: "discord",
    });
  });

  it("syncs newly projected account signups into Brevo when the list is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 501 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "jmh@example.com",
          email_confirmed_at: "2026-04-03T12:00:00Z",
          app_metadata: { provider: "email" },
          user_metadata: {
            userName: "jmhtruman",
            firstName: "John",
            lastName: "Truman",
            displayName: "John Truman",
            beMarketingOptIn: true,
            beMarketingConsentTextVersion: "account-signup-v1",
          },
          identities: [{ provider: "email" }],
        },
      },
      error: null,
    });

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
    });

    await expect(service.getCurrentUserProfile("test-token")).resolves.toMatchObject({
      profile: {
        subject: "auth-user-1",
        userName: "jmhtruman",
        email: "jmh@example.com",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/contacts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "api-key": "brevo-api-key",
          accept: "application/json",
          "content-type": "application/json",
        }),
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("\"email\":\"jmh@example.com\"");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("\"SOURCE\":\"account_signup\"");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("\"BE_LIFECYCLE_STATUS\":\"converted\"");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("\"BE_ROLE_INTEREST\":\"player\"");
    expect(tables.app_users[0]).toMatchObject({
      user_name: "jmhtruman",
      brevo_contact_id: "501",
      brevo_sync_state: "synced",
    });
  });

  it("skips Brevo sync for newly projected account signups when the user did not opt in", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "jmh@example.com",
          email_confirmed_at: "2026-04-03T12:00:00Z",
          app_metadata: { provider: "email" },
          user_metadata: {
            userName: "jmhtruman",
            firstName: "John",
            lastName: "Truman",
            displayName: "John Truman",
            beMarketingOptIn: false,
          },
          identities: [{ provider: "email" }],
        },
      },
      error: null,
    });

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "brevo-api-key",
      BREVO_SIGNUPS_LIST_ID: "12",
    });

    await expect(service.getCurrentUserResponse("test-token")).resolves.toMatchObject({
      subject: "auth-user-1",
      displayName: "John Truman",
      email: "jmh@example.com",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(tables.app_users[0]).toMatchObject({
      user_name: "jmhtruman",
      brevo_contact_id: null,
      brevo_sync_state: "skipped",
    });
  });

  it("fills in a provider avatar for existing users when the local profile does not have one", async () => {
    tables.app_users.push({
      id: "user-1",
      auth_user_id: "auth-user-1",
      user_name: "ava.garcia",
      display_name: "Ava Garcia",
      first_name: "Ava",
      last_name: "Garcia",
      email: "ava@example.com",
      email_verified: true,
      identity_provider: "discord",
      avatar_url: null,
      avatar_storage_path: null,
      updated_at: "2026-03-01T00:00:00Z",
    });

    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "ava@example.com",
          email_confirmed_at: "2026-04-01T00:00:00Z",
          app_metadata: { provider: "discord" },
          user_metadata: {
            avatar_url: "https://cdn.discordapp.com/avatars/456/avatar.png",
          },
          identities: [{ provider: "discord" }],
        },
      },
      error: null,
    });

    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await expect(service.getCurrentUserProfile("test-token")).resolves.toMatchObject({
      profile: {
        subject: "auth-user-1",
        avatarUrl: "https://cdn.discordapp.com/avatars/456/avatar.png",
      },
    });

    expect(tables.app_users[0]).toMatchObject({
      avatar_url: "https://cdn.discordapp.com/avatars/456/avatar.png",
      avatar_storage_path: null,
    });
  });
});

describe("WorkerAppService.recordAnalyticsEvent", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("writes an environment-aware analytics datapoint when the dataset binding is available", async () => {
    const writeDataPoint = vi.fn();
    const service = new WorkerAppService({
      APP_ENV: "staging",
      BE_ANALYTICS: { writeDataPoint } as AnalyticsEngineDataset,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const response = await service.recordAnalyticsEvent({
      event: "title_get_clicked",
      path: "/browse/cloudline-studio/hearthside-protocol",
      authState: "authenticated",
      studioSlug: "cloudline-studio",
      titleSlug: "hearthside-protocol",
      surface: "title-detail",
      contentKind: "game",
      sessionId: "session-123",
      visitorId: "visitor-456",
      referrerPath: "/browse",
      metadata: {
        source: "title-detail-page",
      },
      value1: 42,
    });

    expect(response).toEqual({
      accepted: true,
      analyticsEnabled: true,
    });
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["staging:title_get_clicked"],
      blobs: [
        "staging",
        "title_get_clicked",
        "/browse/cloudline-studio/hearthside-protocol",
        "authenticated",
        null,
        "cloudline-studio",
        "hearthside-protocol",
        "title-detail",
        "game",
        "session-123",
        "visitor-456",
        "/browse",
        JSON.stringify({ source: "title-detail-page" }),
      ],
      doubles: [42, -1],
    });
  });

  it("accepts analytics events without failing when the dataset binding is absent", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await expect(
      service.recordAnalyticsEvent({
        event: "page_view",
        path: "/browse",
      }),
    ).resolves.toEqual({
      accepted: true,
      analyticsEnabled: false,
    });
  });

  it("records unique title detail views once per title and IP address", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.recordAnalyticsEvent({
      event: "title_detail_viewed",
      path: "/browse/blue-harbor-games/lantern-drift",
      authState: "authenticated",
      studioSlug: "blue-harbor-games",
      titleSlug: "lantern-drift",
      surface: "title-detail",
      visitorId: "visitor-1",
      metadata: { titleId: "title-1" },
    }, {
      countryCode: "US",
      ipAddress: "203.0.113.10",
    });
    await service.recordAnalyticsEvent({
      event: "title_detail_viewed",
      path: "/browse/blue-harbor-games/lantern-drift",
      authState: "anonymous",
      studioSlug: "blue-harbor-games",
      titleSlug: "lantern-drift",
      surface: "title-detail",
      visitorId: "visitor-2",
      metadata: { titleId: "title-1" },
    }, {
      countryCode: "US",
      ipAddress: "203.0.113.10",
    });
    await service.recordAnalyticsEvent({
      event: "title_detail_viewed",
      path: "/browse/blue-harbor-games/hearthside-protocol",
      authState: "anonymous",
      studioSlug: "blue-harbor-games",
      titleSlug: "hearthside-protocol",
      surface: "title-detail",
      visitorId: "visitor-1",
      metadata: { titleId: "title-2" },
    }, {
      countryCode: "CA",
      ipAddress: "203.0.113.10",
    });

    expect(tables.title_detail_views).toHaveLength(2);
    expect(tables.title_detail_views[0]).toMatchObject({
      title_id: "title-1",
      viewer_source: "ip_address",
      auth_state: "anonymous",
      studio_slug: "blue-harbor-games",
      title_slug: "lantern-drift",
      surface: "title-detail",
      app_environment: "staging",
      first_country_code: "US",
      last_country_code: "US",
    });
    expect(tables.title_detail_views[1]).toMatchObject({
      title_id: "title-2",
      viewer_source: "ip_address",
      title_slug: "hearthside-protocol",
      last_country_code: "CA",
    });
    expect(tables.title_detail_views[0]!.viewer_hash).not.toBe("203.0.113.10");
  });

  it("records unique BE Home title detail views once per title and Board device", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.recordBeHomeTitleDetailView(
      {
        titleId: "title-1",
        studioSlug: "blue-harbor-games",
        titleSlug: "lantern-drift",
        surface: "title-detail",
      },
      {
        sessionId: "be-home-session-1",
        deviceId: "board-install-1",
        deviceIdSource: "install_id",
        authState: "anonymous",
        clientVersion: "1.2.3",
        appEnvironment: "staging",
      },
      {
        countryCode: "US",
      },
    );
    await service.recordBeHomeTitleDetailView(
      {
        titleId: "title-1",
        studioSlug: "blue-harbor-games",
        titleSlug: "lantern-drift",
        surface: "title-detail",
      },
      {
        sessionId: "be-home-session-2",
        deviceId: "board-install-1",
        deviceIdSource: "install_id",
        authState: "signed_in",
        clientVersion: "1.2.3",
        appEnvironment: "staging",
      },
      {
        countryCode: "CA",
      },
    );
    await service.recordBeHomeTitleDetailView(
      {
        titleId: "title-2",
        studioSlug: "blue-harbor-games",
        titleSlug: "hearthside-protocol",
        surface: "title-detail",
      },
      {
        sessionId: "be-home-session-3",
        deviceId: "board-install-1",
        deviceIdSource: "install_id",
        authState: "signed_in",
        clientVersion: "1.2.3",
        appEnvironment: "staging",
      },
      {
        countryCode: "CA",
      },
    );

    expect(tables.title_detail_views).toHaveLength(2);
    expect(tables.title_detail_views[0]).toMatchObject({
      title_id: "title-1",
      viewer_source: "be_home_device",
      auth_state: "authenticated",
      studio_slug: "blue-harbor-games",
      title_slug: "lantern-drift",
      surface: "title-detail",
      app_environment: "staging",
      first_country_code: "US",
      last_country_code: "CA",
    });
    expect(tables.title_detail_views[1]).toMatchObject({
      title_id: "title-2",
      viewer_source: "be_home_device",
      title_slug: "hearthside-protocol",
      last_country_code: "CA",
    });
    expect(tables.title_detail_views[0]!.viewer_hash).not.toBe("board-install-1");
  });
});

describe("WorkerAppService.verifyCurrentUserPassword", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("verifies the current password for the signed-in user", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: {
        id: "user-1",
        auth_user_id: "auth-user-1",
        user_name: "emma.torres",
        display_name: "Emma Torres",
        first_name: "Emma",
        last_name: "Torres",
        email: "emma.torres@boardtpl.local",
        email_verified: true,
        identity_provider: "email",
        avatar_url: null,
      },
      roles: ["developer"],
    });

    supabaseAuthMocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });

    await expect(service.verifyCurrentUserPassword("test-token", { currentPassword: "Developer!123" })).resolves.toEqual({
      verified: true,
    });

    expect(supabaseAuthMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "emma.torres@boardtpl.local",
      password: "Developer!123",
    });
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co",
      "publishable-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      })
    );
  });
});

describe("WorkerAppService.unarchiveTitle", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("moves an archived title back to draft and keeps it unlisted", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    tables.titles.push({
      id: "title-1",
      lifecycle_status: "archived",
      visibility: "unlisted",
      updated_at: "2026-03-25T00:00:00.000Z",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: {
        id: "user-1",
        auth_user_id: "auth-user-1",
        user_name: "emma.torres",
        display_name: "Emma Torres",
        first_name: "Emma",
        last_name: "Torres",
        email: "emma.torres@boardtpl.local",
        email_verified: true,
        identity_provider: "email",
        avatar_url: null,
      },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "requireDeveloperTitleAccess" as never).mockResolvedValue({
      id: "title-1",
      lifecycle_status: "archived",
      visibility: "unlisted",
    });
    vi.spyOn(service as never, "getDeveloperTitleDetails" as never).mockResolvedValue({
      id: "title-1",
      studioId: "studio-1",
      studioSlug: "blue-harbor-games",
      slug: "lantern-drift",
      displayName: "Lantern Drift",
      shortDescription: "A thoughtful puzzle adventure.",
      description: "A thoughtful puzzle adventure.",
      genreSlugs: ["adventure", "puzzle"],
      contentKind: "game",
      lifecycleStatus: "draft",
      visibility: "unlisted",
      genreDisplay: "Adventure, Puzzle",
      minPlayers: 1,
      maxPlayers: 4,
      ageRatingAuthority: null,
      ageRatingValue: null,
      minAgeYears: null,
      playerCountDisplay: "1-4 players",
      ageDisplay: "Ages 10+",
      currentMetadataRevision: 3,
      acquisitionUrl: null,
      currentRelease: null,
    });

    await expect(service.unarchiveTitle("test-token", "title-1")).resolves.toEqual({
      title: expect.objectContaining({
        id: "title-1",
        lifecycleStatus: "draft",
        visibility: "unlisted",
      }),
    });

    expect(tables.titles[0]).toMatchObject({
      id: "title-1",
      lifecycle_status: "draft",
      visibility: "unlisted",
    });
  });
});

describe("WorkerAppService title analytics projections", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("includes wishlist and library counts in catalog title detail responses", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "getStudioByIdentifier" as never).mockResolvedValue({
      id: "studio-1",
      slug: "blue-harbor-games",
      display_name: "Blue Harbor Games",
    });
    vi.spyOn(service as never, "getTitleByStudioAndIdentifier" as never).mockResolvedValue({
      id: "title-1",
      studio_id: "studio-1",
      slug: "lantern-drift",
      content_kind: "game",
      lifecycle_status: "active",
      visibility: "listed",
      is_reported: false,
      current_metadata_revision: 2,
      display_name: "Lantern Drift",
      short_description: "Guide glowing paper boats through midnight canals.",
      description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
      genre_display: "Puzzle, Family",
      min_players: 1,
      max_players: 4,
      max_players_or_more: true,
      age_rating_authority: "ESRB",
      age_rating_value: "E",
      min_age_years: 6,
      current_release_id: "release-1",
      current_release_version: "1.0.0",
      current_release_published_at: "2026-03-08T12:00:00Z",
      acquisition_url: "https://example.com/lantern-drift",
      created_at: "2026-03-08T12:00:00Z",
      updated_at: "2026-03-08T12:00:00Z",
    });
    vi.spyOn(service as never, "getTitleMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getTitleShowcaseMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getTitleReleaseRowsByIds" as never).mockResolvedValue(new Map([["release-1", {
      id: "release-1",
      title_id: "title-1",
      version: "1.0.0",
      status: "production",
      acquisition_url: "https://example.com/lantern-drift",
      expires_at: null,
      is_current: true,
      published_at: "2026-03-08T12:00:00Z",
      created_at: "2026-03-08T12:00:00Z",
      updated_at: "2026-03-08T12:00:00Z",
    }]]));
    vi.spyOn(service as never, "getTitleCollectionCounts" as never).mockResolvedValue(new Map([["title-1", { wishlistCount: 24, libraryCount: 9, viewCount: 41 }]]));

    await expect(service.getCatalogTitle(null, "blue-harbor-games", "lantern-drift")).resolves.toEqual(
      expect.objectContaining({
        title: expect.objectContaining({
          id: "title-1",
          maxPlayersOrMore: true,
          playerCountDisplay: "1-4+ players",
          viewCount: 41,
          wishlistCount: 24,
          libraryCount: 9,
        }),
      }),
    );
  });

  it("accepts studio and title ids when resolving catalog title details", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "getStudioByIdentifier" as never).mockResolvedValue({
      id: "studio-1",
      slug: "blue-harbor-games",
      display_name: "Blue Harbor Games",
    });
    vi.spyOn(service as never, "getTitleByStudioAndIdentifier" as never).mockResolvedValue({
      id: "title-1",
      studio_id: "studio-1",
      slug: "lantern-drift",
      content_kind: "game",
      lifecycle_status: "active",
      visibility: "listed",
      is_reported: false,
      current_metadata_revision: 2,
      display_name: "Lantern Drift",
      short_description: "Guide glowing paper boats through midnight canals.",
      description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
      genre_display: "Puzzle, Family",
      min_players: 1,
      max_players: 4,
      max_players_or_more: false,
      age_rating_authority: "ESRB",
      age_rating_value: "E",
      min_age_years: 6,
      current_release_id: null,
      current_release_version: null,
      current_release_published_at: null,
      acquisition_url: "https://example.com/lantern-drift",
      created_at: "2026-03-08T12:00:00Z",
      updated_at: "2026-03-08T12:00:00Z",
    });
    vi.spyOn(service as never, "getTitleMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getCatalogMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getTitleShowcaseMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getTitleReleaseRowsByIds" as never).mockResolvedValue(new Map());
    vi.spyOn(service as never, "getTitleCollectionCounts" as never).mockResolvedValue(new Map([["title-1", { wishlistCount: 0, libraryCount: 0 }]]));

    await expect(service.getCatalogTitle(null, "studio-1", "title-1")).resolves.toEqual(
      expect.objectContaining({
        title: expect.objectContaining({
          id: "title-1",
          studioSlug: "blue-harbor-games",
          slug: "lantern-drift",
        }),
      }),
    );
  });

  it("accepts a studio id when resolving a public studio profile", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "getStudioByIdentifier" as never).mockResolvedValue({
      id: "studio-1",
      slug: "blue-harbor-games",
      display_name: "Blue Harbor Games",
      description: "A friendly co-op studio.",
    });
    vi.spyOn(service as never, "getStudioLinksByStudioIds" as never).mockResolvedValue(new Map([["studio-1", []]]));
    vi.spyOn(service as never, "getStudioFollowerCounts" as never).mockResolvedValue(new Map([["studio-1", 12]]));
    vi.spyOn(service as never, "getStudioMediaByStudioIds" as never).mockResolvedValue(new Map([["studio-1", []]]));

    await expect(service.getPublicStudio("studio-1")).resolves.toEqual({
      studio: expect.objectContaining({
        id: "studio-1",
        slug: "blue-harbor-games",
        displayName: "Blue Harbor Games",
        followerCount: 12,
      }),
    });
  });

  it("includes wishlist and library counts in developer title details", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });
    const serviceAccess = asWorkerAppServicePrivateTestAccess(service);

    vi.spyOn(service as never, "requireDeveloperTitleAccess" as never).mockResolvedValue({
      id: "title-1",
      studio_id: "studio-1",
      slug: "lantern-drift",
      content_kind: "game",
      lifecycle_status: "active",
      visibility: "listed",
      is_reported: false,
      current_metadata_revision: 2,
      display_name: "Lantern Drift",
      short_description: "Guide glowing paper boats through midnight canals.",
      description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
      genre_display: "Puzzle, Family",
      min_players: 1,
      max_players: 4,
      max_players_or_more: true,
      age_rating_authority: "ESRB",
      age_rating_value: "E",
      min_age_years: 6,
      current_release_id: "release-1",
      current_release_version: "1.0.0",
      current_release_published_at: "2026-03-08T12:00:00Z",
      acquisition_url: "https://example.com/lantern-drift",
      created_at: "2026-03-08T12:00:00Z",
      updated_at: "2026-03-08T12:00:00Z",
    });
    vi.spyOn(service as never, "getStudioById" as never).mockResolvedValue({
      id: "studio-1",
      slug: "blue-harbor-games",
      display_name: "Blue Harbor Games",
    });
    vi.spyOn(service as never, "getTitleMediaAssetsForTitle" as never).mockResolvedValue([]);
    vi.spyOn(service as never, "getTitleShowcaseMediaForTitle" as never).mockResolvedValue([]);
    vi.spyOn(service as never, "getGenreSlugsForMetadataVersion" as never).mockResolvedValue(["puzzle", "family"]);
    vi.spyOn(service as never, "requireTitleRelease" as never).mockResolvedValue({
      id: "release-1",
      title_id: "title-1",
      version: "1.0.0",
      status: "production",
      acquisition_url: "https://example.com/lantern-drift",
      expires_at: null,
      is_current: true,
      published_at: "2026-03-08T12:00:00Z",
      created_at: "2026-03-08T12:00:00Z",
      updated_at: "2026-03-08T12:00:00Z",
    });
    vi.spyOn(service as never, "getTitleCollectionCounts" as never).mockResolvedValue(new Map([["title-1", { wishlistCount: 18, libraryCount: 7, viewCount: 63 }]]));

    await expect(serviceAccess.getDeveloperTitleDetails("user-1", "title-1")).resolves.toEqual(
      expect.objectContaining({
        id: "title-1",
        maxPlayersOrMore: true,
        playerCountDisplay: "1-4+ players",
        viewCount: 63,
        wishlistCount: 18,
        libraryCount: 7,
      }),
    );
  });

  it("keeps open-ended player ranges in catalog results when the minimum-player filter exceeds the numeric max", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "getTitles" as never).mockResolvedValue([
      {
        id: "title-1",
        studio_id: "studio-1",
        slug: "lantern-drift",
        content_kind: "game",
        lifecycle_status: "active",
        visibility: "listed",
        is_reported: false,
        current_metadata_revision: 2,
        display_name: "Lantern Drift",
        short_description: "Guide glowing paper boats through midnight canals.",
        description: "Tilt waterways, spin lock-gates, and weave through fireworks across the river.",
        genre_display: "Puzzle, Family",
        min_players: 2,
        max_players: 4,
        max_players_or_more: true,
        age_rating_authority: "ESRB",
        age_rating_value: "E",
        min_age_years: 6,
        current_release_id: null,
        current_release_version: null,
        current_release_published_at: null,
        acquisition_url: null,
        created_at: "2026-03-08T12:00:00Z",
        updated_at: "2026-03-08T12:00:00Z",
      },
    ]);
    vi.spyOn(service as never, "getStudiosByIds" as never).mockResolvedValue([
      {
        id: "studio-1",
        slug: "blue-harbor-games",
        display_name: "Blue Harbor Games",
        description: "Puzzle adventures for local game nights.",
        avatar_url: null,
        avatar_storage_path: null,
        logo_url: null,
        logo_storage_path: null,
        banner_url: null,
        banner_storage_path: null,
        created_at: "2026-03-08T12:00:00Z",
        updated_at: "2026-03-08T12:00:00Z",
        created_by_user_id: "user-1",
      },
    ]);
    vi.spyOn(service as never, "getTitleMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getCatalogMediaByTitleIds" as never).mockResolvedValue(new Map([["title-1", []]]));
    vi.spyOn(service as never, "getTitleReleaseRowsByIds" as never).mockResolvedValue(new Map());
    vi.spyOn(service as never, "getTitleCollectionCounts" as never).mockResolvedValue(new Map());

    await expect(service.listCatalogTitles({ minPlayers: 6 })).resolves.toEqual(
      expect.objectContaining({
        titles: [
          expect.objectContaining({
            id: "title-1",
            maxPlayersOrMore: true,
            playerCountDisplay: "2-4+ players",
          }),
        ],
      }),
    );
  });
});

describe("WorkerAppService studio slug normalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("derives the persisted studio slug from the display name when creating a studio", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const now = "2026-04-08T12:00:00Z";
    const createdStudio = {
      id: "studio-1",
      slug: "the-shapers-guild",
      display_name: "The Shaper's Guild",
      description: "Board builders.",
      created_by_user_id: "developer-user-id",
      created_at: now,
      updated_at: now,
    };

    const studiosInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: createdStudio, error: null }),
      }),
    });
    const membershipsInsert = vi.fn().mockResolvedValue({ error: null });

    Object.defineProperty(service, "client", {
      configurable: true,
      value: {
        from(tableName: string) {
          if (tableName === "studios") {
            return {
              insert: studiosInsert,
            };
          }

          if (tableName === "studio_memberships") {
            return {
              insert: membershipsInsert,
            };
          }

          throw new Error(`Unexpected table ${tableName}`);
        },
      },
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "developer-user-id" },
      roles: ["developer"],
    });
    const findStudioBySlug = vi.spyOn(service as never, "findStudioBySlug" as never).mockResolvedValue(null);
    vi.spyOn(service as never, "getStudioMediaByStudioIds" as never).mockResolvedValue(new Map([["studio-1", []]]));

    await expect(
      service.createStudio("developer-token", {
        slug: "the-shaper-s-guild",
        displayName: "The Shaper's Guild",
        description: "Board builders.",
      }),
    ).resolves.toEqual({
      studio: expect.objectContaining({
        id: "studio-1",
        slug: "the-shapers-guild",
      }),
    });

    expect(findStudioBySlug).toHaveBeenCalledWith("the-shapers-guild");
    expect(studiosInsert).toHaveBeenCalledWith(expect.objectContaining({
      slug: "the-shapers-guild",
      display_name: "The Shaper's Guild",
    }));
  });

  it("re-derives the studio slug from the display name when updating a studio", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    let pendingStudioUpdate: Record<string, unknown> | null = null;

    Object.defineProperty(service, "client", {
      configurable: true,
      value: {
        from(tableName: string) {
          if (tableName === "studios") {
            return {
              update(payload: Record<string, unknown>) {
                pendingStudioUpdate = payload;
                return {
                  eq: vi.fn().mockResolvedValue({ error: null }),
                };
              },
            };
          }

          throw new Error(`Unexpected table ${tableName}`);
        },
      },
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "developer-user-id" },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "getStudioById" as never)
      .mockResolvedValueOnce({
        id: "studio-1",
        slug: "the-shaper-s-guild",
        display_name: "The Shaper's Guild",
        description: "Old description.",
        created_by_user_id: "developer-user-id",
        created_at: "2026-04-07T12:00:00Z",
        updated_at: "2026-04-07T12:00:00Z",
      })
      .mockResolvedValueOnce({
        id: "studio-1",
        slug: "the-shapers-guild",
        display_name: "The Shaper's Guild",
        description: "New description.",
        created_by_user_id: "developer-user-id",
        created_at: "2026-04-07T12:00:00Z",
        updated_at: "2026-04-08T12:00:00Z",
      });
    vi.spyOn(service as never, "requireStudioAccess" as never).mockResolvedValue(undefined);
    const findStudioBySlug = vi.spyOn(service as never, "findStudioBySlug" as never).mockResolvedValue(null);
    vi.spyOn(service as never, "getStudioLinksByStudioIds" as never).mockResolvedValue(new Map([["studio-1", []]]));
    vi.spyOn(service as never, "getStudioFollowerCounts" as never).mockResolvedValue(new Map([["studio-1", 0]]));
    vi.spyOn(service as never, "getStudioMediaByStudioIds" as never).mockResolvedValue(new Map([["studio-1", []]]));

    await expect(
      service.updateStudio("developer-token", "studio-1", {
        slug: "the-shaper-s-guild",
        displayName: "The Shaper's Guild",
        description: "New description.",
      }),
    ).resolves.toEqual({
      studio: expect.objectContaining({
        id: "studio-1",
        slug: "the-shapers-guild",
      }),
    });

    expect(findStudioBySlug).toHaveBeenCalledWith("the-shapers-guild");
    expect(pendingStudioUpdate).toEqual(expect.objectContaining({
      slug: "the-shapers-guild",
      display_name: "The Shaper's Guild",
      description: "New description.",
    }));
  });
});

describe("WorkerAppService identifier slug fallback", () => {
  it("falls back to studio slug lookup when the identifier is not a valid uuid", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const studioRow = {
      id: "7562f8db-6e19-495e-975c-c807156dc491",
      slug: "pine-lantern-labs",
      display_name: "Pine Lantern Labs",
      description: "Board builders.",
      created_by_user_id: "developer-user-id",
      created_at: "2026-04-08T12:00:00Z",
      updated_at: "2026-04-08T12:00:00Z",
    };

    Object.defineProperty(service, "client", {
      configurable: true,
      value: {
        from(tableName: string) {
          const filters: Array<{ column: string; value: unknown }> = [];
          return {
            select() {
              return this;
            },
            eq(column: string, value: unknown) {
              filters.push({ column, value });
              return this;
            },
            limit() {
              if (tableName !== "studios") {
                throw new Error(`Unexpected table ${tableName}`);
              }

              const idFilter = filters.find((entry) => entry.column === "id");
              if (idFilter?.value === "pine-lantern-labs") {
                return Promise.resolve({ data: null, error: { code: "22P02", message: "invalid input syntax for type uuid" } });
              }

              const slugFilter = filters.find((entry) => entry.column === "slug");
              if (slugFilter?.value === "pine-lantern-labs") {
                return Promise.resolve({ data: [studioRow], error: null });
              }

              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      },
    });

    vi.spyOn(service as never, "getStudioLinksByStudioIds" as never).mockResolvedValue(new Map([[studioRow.id, []]]));
    vi.spyOn(service as never, "getStudioFollowerCounts" as never).mockResolvedValue(new Map([[studioRow.id, 0]]));
    vi.spyOn(service as never, "getStudioMediaByStudioIds" as never).mockResolvedValue(new Map([[studioRow.id, []]]));

    await expect(service.getPublicStudio("pine-lantern-labs")).resolves.toEqual({
      studio: expect.objectContaining({
        id: studioRow.id,
        slug: "pine-lantern-labs",
      }),
    });
  });

  it("falls back to title slug lookup when the title identifier is not a valid uuid", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const studioRow = {
      id: "7562f8db-6e19-495e-975c-c807156dc491",
      slug: "pine-lantern-labs",
      display_name: "Pine Lantern Labs",
      description: "Board builders.",
      created_by_user_id: "developer-user-id",
      created_at: "2026-04-08T12:00:00Z",
      updated_at: "2026-04-08T12:00:00Z",
    };
    const titleRow = {
      id: "ec26b7df-158c-4ff4-a5fa-a282b57096fa",
      studio_id: studioRow.id,
      slug: "the-shapers-oracle",
      content_kind: "game",
      lifecycle_status: "active",
      visibility: "listed",
      is_reported: false,
      current_metadata_revision: 1,
      display_name: "The Shaper's Oracle",
      short_description: "Shape destiny.",
      description: "Shape destiny.",
      genre_display: "Puzzle",
      min_players: 1,
      max_players: 4,
      max_players_or_more: false,
      age_rating_authority: null,
      age_rating_value: null,
      min_age_years: 10,
      current_release_id: null,
      current_release_version: null,
      current_release_published_at: null,
      acquisition_url: null,
      created_at: "2026-04-08T12:00:00Z",
      updated_at: "2026-04-08T12:00:00Z",
    };

    Object.defineProperty(service, "client", {
      configurable: true,
      value: {
        from(tableName: string) {
          const filters: Array<{ column: string; value: unknown }> = [];
          return {
            select() {
              return this;
            },
            eq(column: string, value: unknown) {
              filters.push({ column, value });
              return this;
            },
            limit() {
              if (tableName === "studios") {
                const idFilter = filters.find((entry) => entry.column === "id");
                if (idFilter?.value === "pine-lantern-labs") {
                  return Promise.resolve({ data: null, error: { code: "22P02", message: "invalid input syntax for type uuid" } });
                }

                const slugFilter = filters.find((entry) => entry.column === "slug");
                if (slugFilter?.value === "pine-lantern-labs") {
                  return Promise.resolve({ data: [studioRow], error: null });
                }
              }

              if (tableName === "titles") {
                const idFilter = filters.find((entry) => entry.column === "id");
                if (idFilter?.value === "the-shapers-oracle") {
                  return Promise.resolve({ data: null, error: { code: "22P02", message: "invalid input syntax for type uuid" } });
                }

                const slugFilter = filters.find((entry) => entry.column === "slug");
                const studioFilter = filters.find((entry) => entry.column === "studio_id");
                if (slugFilter?.value === "the-shapers-oracle" && studioFilter?.value === studioRow.id) {
                  return Promise.resolve({ data: [titleRow], error: null });
                }
              }

              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      },
    });

    vi.spyOn(service as never, "getTitleMediaByTitleIds" as never).mockResolvedValue(new Map([[titleRow.id, []]]));
    vi.spyOn(service as never, "getCatalogMediaByTitleIds" as never).mockResolvedValue(new Map([[titleRow.id, []]]));
    vi.spyOn(service as never, "getTitleShowcaseMediaByTitleIds" as never).mockResolvedValue(new Map([[titleRow.id, []]]));
    vi.spyOn(service as never, "getTitleReleaseRowsByIds" as never).mockResolvedValue(new Map());
    vi.spyOn(service as never, "getTitleCollectionCounts" as never).mockResolvedValue(new Map([[titleRow.id, { wishlistCount: 0, libraryCount: 0 }]]));

    await expect(service.getCatalogTitle(null, "pine-lantern-labs", "the-shapers-oracle")).resolves.toEqual(
      expect.objectContaining({
        title: expect.objectContaining({
          id: titleRow.id,
          studioSlug: "pine-lantern-labs",
          slug: "the-shapers-oracle",
        }),
      }),
    );
  });
});

describe("WorkerAppService moderation title reports", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("keeps moderation report summaries visible when the related title, studio, or reporter records are gone", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "moderator-user-id" },
      roles: ["moderator"],
    });
    vi.spyOn(service as never, "getTitleReports" as never).mockResolvedValue([
      {
        id: "report-1",
        title_id: "missing-title-id",
        reporter_user_id: "missing-reporter-id",
        status: "submitted",
        reason: "The title metadata looks incorrect.",
        resolved_at: null,
        updated_at: "2026-04-07T12:00:00Z",
        created_at: "2026-04-07T11:00:00Z",
      },
    ]);
    vi.spyOn(service as never, "getTitlesByIds" as never).mockResolvedValue([]);
    vi.spyOn(service as never, "getStudiosByIds" as never).mockResolvedValue([]);
    vi.spyOn(service as never, "getUsersByIds" as never).mockResolvedValue([]);
    vi.spyOn(service as never, "getTitleReportMessageCounts" as never).mockResolvedValue(new Map([["report-1", 3]]));

    await expect(service.listModerationTitleReports("moderator-token")).resolves.toEqual({
      reports: [
        expect.objectContaining({
          id: "report-1",
          titleId: "missing-title-id",
          titleDisplayName: "Unavailable title",
          studioDisplayName: "Unavailable studio",
          reporterSubject: "deleted-user:missing-reporter-id",
          messageCount: 3,
        }),
      ],
    });
  });

  it("keeps moderation report detail messages visible when message authors are gone", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });
    const serviceAccess = asWorkerAppServicePrivateTestAccess(service);

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "moderator-user-id" },
      roles: ["moderator"],
    });
    vi.spyOn(service as never, "getTitleReportById" as never).mockResolvedValue({
      id: "report-1",
      title_id: "title-1",
      reporter_user_id: "reporter-1",
      resolved_by_user_id: null,
      status: "developer_responded",
      reason: "The title page has broken content.",
      resolution_note: null,
      resolved_at: null,
      updated_at: "2026-04-07T12:00:00Z",
      created_at: "2026-04-07T11:00:00Z",
    });
    vi.spyOn(service as never, "getTitlesByIds" as never).mockResolvedValue([
      {
        id: "title-1",
        studio_id: "studio-1",
        slug: "deploy-smoke-title-revised",
        display_name: "Deploy Smoke Title Revised",
        short_description: "Smoke test title.",
        genre_display: "Utility",
        current_metadata_revision: 2,
      },
    ]);
    vi.spyOn(service as never, "getStudiosByIds" as never).mockResolvedValue([
      {
        id: "studio-1",
        slug: "production-smoke-studio",
        display_name: "Production Smoke Studio",
      },
    ]);
    vi.spyOn(serviceAccess, "getUsersByIds").mockImplementation(async (...args: unknown[]) => {
      const [userIds] = args as [string[]];
      const knownUsers = userIds
        .filter((userId) => userId === "reporter-1")
        .map(() => ({
          id: "reporter-1",
          auth_user_id: "auth-reporter-1",
          user_name: "prod.smoke.player",
          display_name: "Production Smoke Player",
          first_name: "Production",
          last_name: "Player",
          email: "testing+player@boardenthusiasts.com",
          email_verified: true,
          identity_provider: "email",
          avatar_url: null,
          updated_at: "2026-04-07T11:00:00Z",
        }));
      return knownUsers;
    });
    vi.spyOn(service as never, "getTitleReportMessages" as never).mockResolvedValue([
      {
        id: "message-1",
        report_id: "report-1",
        author_user_id: "deleted-developer-id",
        author_role: "developer",
        audience: "all",
        message: "We have reviewed the issue and need more detail.",
        created_at: "2026-04-07T11:30:00Z",
      },
    ]);
    vi.spyOn(service as never, "getTitleReportMessageCounts" as never).mockResolvedValue(new Map([["report-1", 1]]));

    await expect(service.getModerationTitleReport("moderator-token", "report-1")).resolves.toEqual({
      report: expect.objectContaining({
        report: expect.objectContaining({
          id: "report-1",
          titleDisplayName: "Deploy Smoke Title Revised",
          studioDisplayName: "Production Smoke Studio",
        }),
        messages: [
          expect.objectContaining({
            id: "message-1",
            authorSubject: "deleted-user:deleted-developer-id",
            authorDisplayName: null,
            authorUserName: null,
            message: "We have reviewed the issue and need more detail.",
          }),
        ],
      }),
    });
  });
});

describe("WorkerAppService Board profile", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("returns a null Board profile when the current user has not linked one", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "user-1" },
      roles: ["player"],
    });

    await expect(service.getBoardProfile("player-token")).resolves.toEqual({
      boardProfile: null,
    });
  });

  it("returns the linked Board profile when the current user has one", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    tables.user_board_profiles.push({
      user_id: "user-1",
      board_user_id: "board_emma_torres",
      display_name: "Emma Torres",
      avatar_url: "https://cdn.board.fun/avatars/board_emma_torres.png",
      linked_at: "2026-03-08T00:00:00.000Z",
      last_synced_at: "2026-03-08T00:00:00.000Z",
      updated_at: "2026-03-08T00:00:00.000Z",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "user-1" },
      roles: ["player"],
    });

    await expect(service.getBoardProfile("player-token")).resolves.toEqual({
      boardProfile: {
        boardUserId: "board_emma_torres",
        displayName: "Emma Torres",
        avatarUrl: "https://cdn.board.fun/avatars/board_emma_torres.png",
        linkedAt: "2026-03-08T00:00:00.000Z",
        lastSyncedAt: "2026-03-08T00:00:00.000Z",
      },
    });
  });
});

describe("WorkerAppService current-user notifications", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("clears all notifications for the current user", async () => {
    tables.user_notifications.push(
      {
        id: "notification-1",
        user_id: "user-1",
        category: "title_report",
        title: "Unread notification",
        body: "Unread body",
        action_url: "/player?workflow=reported-titles&reportId=report-1",
        is_read: false,
        read_at: null,
        created_at: "2026-04-07T11:00:00Z",
        updated_at: "2026-04-07T11:00:00Z",
      },
      {
        id: "notification-2",
        user_id: "user-1",
        category: "title_report",
        title: "Read notification",
        body: "Read body",
        action_url: "/player?workflow=reported-titles&reportId=report-2",
        is_read: true,
        read_at: "2026-04-07T11:05:00Z",
        created_at: "2026-04-07T11:01:00Z",
        updated_at: "2026-04-07T11:05:00Z",
      },
      {
        id: "notification-3",
        user_id: "user-2",
        category: "title_report",
        title: "Other user notification",
        body: "Should stay put",
        action_url: null,
        is_read: false,
        read_at: null,
        created_at: "2026-04-07T11:02:00Z",
        updated_at: "2026-04-07T11:02:00Z",
      },
    );

    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "user-1" },
      roles: ["player"],
    });

    await expect(service.clearCurrentUserNotifications("player-token")).resolves.toBeUndefined();
    expect(tables.user_notifications).toEqual([
      expect.objectContaining({
        id: "notification-3",
        user_id: "user-2",
      }),
    ]);
  });
});

describe("WorkerAppService.deleteTitle", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("removes the title row after password confirmation", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    tables.titles.push({
      id: "title-1",
      lifecycle_status: "draft",
      visibility: "unlisted",
      updated_at: "2026-03-25T00:00:00.000Z",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: {
        id: "user-1",
        auth_user_id: "auth-user-1",
        user_name: "emma.torres",
        display_name: "Emma Torres",
        first_name: "Emma",
        last_name: "Torres",
        email: "emma.torres@boardtpl.local",
        email_verified: true,
        identity_provider: "email",
        avatar_url: null,
      },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "requireDeveloperTitleAccess" as never).mockResolvedValue({
      id: "title-1",
      display_name: "Lantern Drift",
    });
    vi.spyOn(service as never, "verifyCurrentUserPasswordValue" as never).mockResolvedValue(undefined);

    await expect(
      service.deleteTitle("test-token", "title-1", {
        currentPassword: "Developer!123",
        confirmationTitleName: "Lantern Drift",
      }),
    ).resolves.toBeUndefined();

    expect(tables.titles).toHaveLength(0);
  });
});

describe("WorkerAppService unified catalog media", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("lists authenticated catalog media types", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "developer-user-id" },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "getCatalogMediaTypeRows" as never).mockResolvedValue([
      {
        key: "title_showcase",
        owner_kind: "title",
        display_name: "Title showcase",
        usage_summary: "Used for screenshots and videos.",
        bucket_name: "hero-images",
        max_upload_bytes: 3145728,
        accepted_mime_types: ["image/webp", "image/png"],
        accepted_file_types: ["WEBP", "PNG"],
        recommended_width: 1920,
        recommended_height: 1080,
        aspect_width: 16,
        aspect_height: 9,
        allows_multiple: true,
        supports_video: true,
        created_at: "2026-04-07T12:00:00Z",
        updated_at: "2026-04-07T12:00:00Z",
      },
    ]);

    await expect(service.listCatalogMediaTypes("developer-token")).resolves.toEqual({
      mediaTypes: [
        {
          key: "title_showcase",
          ownerKind: "title",
          displayName: "Title showcase",
          usageSummary: "Used for screenshots and videos.",
          bucket: "hero-images",
          maxUploadBytes: 3145728,
          acceptedMimeTypes: ["image/webp", "image/png"],
          acceptedFileTypes: ["WEBP", "PNG"],
          recommendedWidth: 1920,
          recommendedHeight: 1080,
          aspectWidth: 16,
          aspectHeight: 9,
          allowsMultiple: true,
          supportsVideo: true,
        },
      ],
    });
  });

  it("maps unified title media entries into legacy title media assets with showcase fallback hero", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "developer-user-id" },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "requireDeveloperTitleAccess" as never).mockResolvedValue({
      id: "title-1",
      studio_id: "studio-1",
      slug: "lantern-drift",
    });
    vi.spyOn(service as never, "getCatalogMediaEntriesForTitle" as never).mockResolvedValue([
      {
        id: "card-entry",
        title_id: "title-1",
        studio_id: null,
        media_type_key: "title_card",
        kind: "image",
        source_url: "https://cdn.example.com/card.webp",
        storage_path: "titles/studio/title/card.webp",
        video_url: null,
        alt_text: "Card art",
        mime_type: "image/webp",
        width: 900,
        height: 900,
        display_order: 0,
        created_at: "2026-04-07T10:00:00Z",
        updated_at: "2026-04-07T10:00:00Z",
      },
      {
        id: "showcase-entry",
        title_id: "title-1",
        studio_id: null,
        media_type_key: "title_showcase",
        kind: "image",
        source_url: "https://cdn.example.com/showcase.webp",
        storage_path: "titles/studio/title/showcase/showcase-entry.webp",
        video_url: null,
        alt_text: "Showcase art",
        mime_type: "image/webp",
        width: 1600,
        height: 900,
        display_order: 0,
        created_at: "2026-04-07T11:00:00Z",
        updated_at: "2026-04-07T11:00:00Z",
      },
      {
        id: "logo-entry",
        title_id: "title-1",
        studio_id: null,
        media_type_key: "title_logo",
        kind: "image",
        source_url: "https://cdn.example.com/logo.webp",
        storage_path: "titles/studio/title/logo.webp",
        video_url: null,
        alt_text: "Logo art",
        mime_type: "image/webp",
        width: 1200,
        height: 400,
        display_order: 0,
        created_at: "2026-04-07T09:00:00Z",
        updated_at: "2026-04-07T09:00:00Z",
      },
    ]);

    await expect(service.getTitleMediaAssets("developer-token", "title-1")).resolves.toEqual({
      mediaAssets: [
        expect.objectContaining({
          id: "card-entry",
          mediaRole: "card",
          sourceUrl: "https://cdn.example.com/card.webp",
        }),
        expect.objectContaining({
          id: "showcase-entry",
          mediaRole: "hero",
          sourceUrl: "https://cdn.example.com/showcase.webp",
        }),
        expect.objectContaining({
          id: "logo-entry",
          mediaRole: "logo",
          sourceUrl: "https://cdn.example.com/logo.webp",
        }),
      ],
    });
  });

  it("creates screenshot showcase media from a direct image url without forcing an upload placeholder", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "developer-user-id" },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "requireDeveloperTitleAccess" as never).mockResolvedValue({
      id: "title-1",
      studio_id: "studio-1",
      slug: "lantern-drift",
    });
    const createCatalogMediaEntryForOwner = vi.spyOn(service as never, "createCatalogMediaEntryForOwner" as never).mockResolvedValue({
      id: "showcase-entry",
      title_id: "title-1",
      studio_id: null,
      media_type_key: "title_showcase",
      kind: "image",
      source_url: "https://cdn.example.com/showcase.webp",
      storage_path: null,
      preview_image_url: null,
      preview_storage_path: null,
      video_url: null,
      alt_text: "Showcase art",
      mime_type: null,
      width: null,
      height: null,
      display_order: 1,
      created_at: "2026-04-07T10:00:00Z",
      updated_at: "2026-04-07T10:00:00Z",
    });

    await expect(
      service.createTitleShowcaseMedia("developer-token", "title-1", {
        kind: "image",
        imageUrl: "https://cdn.example.com/showcase.webp",
        videoUrl: null,
        altText: "Showcase art",
        displayOrder: 1,
      }),
    ).resolves.toEqual({
      showcaseMedia: expect.objectContaining({
        id: "showcase-entry",
        imageUrl: "https://cdn.example.com/showcase.webp",
      }),
    });

    expect(createCatalogMediaEntryForOwner).toHaveBeenCalledWith("title", "title-1", expect.objectContaining({
      mediaTypeKey: "title_showcase",
      kind: "image",
      sourceUrl: "https://cdn.example.com/showcase.webp",
      videoUrl: null,
    }));
  });

  it("re-syncs a title slug when metadata is unchanged but slug normalization rules have changed", async () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const currentVersion = {
      title_id: "title-1",
      revision_number: 1,
      is_current: true,
      is_frozen: false,
      display_name: "The Shaper's Oracle",
      short_description: "Shape destiny.",
      description: "Shape destiny.",
      genre_display: "Puzzle",
      min_players: 1,
      max_players: 4,
      max_players_or_more: false,
      age_rating_authority: "ESRB",
      age_rating_value: "E10+",
      min_age_years: 10,
      created_at: "2026-04-08T12:00:00Z",
      updated_at: "2026-04-08T12:00:00Z",
    };

    vi.spyOn(service as never, "requireUser" as never).mockResolvedValue({
      appUser: { id: "developer-user-id" },
      roles: ["developer"],
    });
    vi.spyOn(service as never, "requireDeveloperTitleAccess" as never).mockResolvedValue({
      id: "title-1",
      studio_id: "studio-1",
      slug: "the-shaper-s-oracle",
    });
    vi.spyOn(service as never, "getCurrentTitleMetadataVersionRow" as never).mockResolvedValue(currentVersion);
    vi.spyOn(service as never, "getGenreSlugsForMetadataVersion" as never).mockResolvedValue(["puzzle"]);
    vi.spyOn(service as never, "requireGenres" as never).mockResolvedValue([{ slug: "puzzle", display_name: "Puzzle" }]);
    vi.spyOn(service as never, "resolveAgeRatingAuthorityCode" as never).mockResolvedValue("ESRB");
    vi.spyOn(service as never, "ensureDerivedTitleSlugAvailable" as never).mockResolvedValue(undefined);
    vi.spyOn(service as never, "titleMetadataMatchesCurrentVersion" as never).mockReturnValue(true);
    const syncTitleFromMetadataVersion = vi.spyOn(service as never, "syncTitleFromMetadataVersion" as never).mockResolvedValue(undefined);
    vi.spyOn(service as never, "getDeveloperTitleDetails" as never).mockResolvedValue({ id: "title-1", slug: "the-shapers-oracle" });

    await expect(
      service.upsertTitleMetadata("developer-token", "title-1", {
        displayName: "The Shaper's Oracle",
        shortDescription: "Shape destiny.",
        description: "Shape destiny.",
        genreSlugs: ["puzzle"],
        minPlayers: 1,
        maxPlayers: 4,
        maxPlayersOrMore: false,
        ageRatingAuthority: "ESRB",
        ageRatingValue: "E10+",
        minAgeYears: 10,
      }),
    ).resolves.toEqual({
      title: { id: "title-1", slug: "the-shapers-oracle" },
    });

    expect(syncTitleFromMetadataVersion).toHaveBeenCalledWith("title-1", currentVersion);
  });
});

describe("canViewerAccessTitleReportMessageAudience", () => {
  it("hides developer-only messages from players", () => {
    expect(canViewerAccessTitleReportMessageAudience("developer", "player")).toBe(false);
    expect(canViewerAccessTitleReportMessageAudience("all", "player")).toBe(true);
    expect(canViewerAccessTitleReportMessageAudience("player", "player")).toBe(true);
  });

  it("hides player-only messages from developers", () => {
    expect(canViewerAccessTitleReportMessageAudience("player", "developer")).toBe(false);
    expect(canViewerAccessTitleReportMessageAudience("all", "developer")).toBe(true);
    expect(canViewerAccessTitleReportMessageAudience("developer", "developer")).toBe(true);
  });

  it("keeps moderator visibility across all report audiences", () => {
    expect(canViewerAccessTitleReportMessageAudience("all", "moderator")).toBe(true);
    expect(canViewerAccessTitleReportMessageAudience("player", "moderator")).toBe(true);
    expect(canViewerAccessTitleReportMessageAudience("developer", "moderator")).toBe(true);
    expect(canViewerAccessTitleReportMessageAudience("unexpected", "moderator")).toBe(true);
  });
});

describe("WorkerAppService BE Home presence", () => {
  beforeEach(() => {
    resetTables();
    vi.restoreAllMocks();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.updateUserById.mockReset();
    supabaseAuthMocks.listUsers.mockReset();
    supabaseAuthMocks.signInWithPassword.mockReset();
  });

  it("upserts a BE Home session and hashes the raw device identifier server-side", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const response = await service.upsertBeHomePresenceSession(
      {
        sessionId: "session-1",
        deviceId: "raw-device-1",
        authState: "anonymous",
        deviceIdSource: "install_id",
        clientVersion: "1.0.0",
        appEnvironment: "production",
      },
      { countryCode: "US" },
    );

    expect(response).toEqual({
      accepted: true,
      session: {
        sessionId: "session-1",
        authState: "anonymous",
        lastSeenAt: expect.any(String),
        heartbeatIntervalSeconds: 60,
        activeTtlSeconds: 180,
      },
    });
    expect(tables.be_home_presence_sessions).toHaveLength(1);
    expect(tables.be_home_device_identities).toHaveLength(1);
    expect(tables.be_home_presence_sessions[0]).toMatchObject({
      session_id: "session-1",
      auth_state: "anonymous",
      country_code: "US",
      client_version: "1.0.0",
      app_environment: "production",
      device_id_source: "install_id",
      ended_at: null,
    });
    expect(tables.be_home_presence_sessions[0]!.device_id_hash).not.toBe("raw-device-1");
    expect(tables.be_home_presence_sessions[0]!.device_id_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(tables.be_home_device_identities[0]).toMatchObject({
      device_id_hash: tables.be_home_presence_sessions[0]!.device_id_hash,
      first_country_code: "US",
      last_country_code: "US",
      last_client_version: "1.0.0",
      last_device_id_source: "install_id",
    });
  });

  it("updates the same BE Home session when auth state changes without duplicating the active count", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.upsertBeHomePresenceSession({
      sessionId: "session-1",
      deviceId: "raw-device-1",
      authState: "anonymous",
      deviceIdSource: "install_id",
      clientVersion: "0.9.0",
      appEnvironment: "production",
    });

    await service.upsertBeHomePresenceSession({
      sessionId: "session-1",
      deviceId: "raw-device-1",
      authState: "signed_in",
      deviceIdSource: "android_secure_android_id",
      clientVersion: "1.0.0",
      appEnvironment: "production",
    });

    expect(tables.be_home_presence_sessions).toHaveLength(1);
    expect(tables.be_home_presence_sessions[0]).toMatchObject({
      session_id: "session-1",
      auth_state: "signed_in",
      client_version: "1.0.0",
      device_id_source: "android_secure_android_id",
      ended_at: null,
    });
    expect(tables.be_home_device_identities).toHaveLength(1);
    expect(tables.be_home_presence_sessions[0]!.device_id_hash).toBe(tables.be_home_device_identities[0]!.device_id_hash);

    await expect(service.getBeHomeMetrics()).resolves.toEqual({
      metrics: {
        activeNowTotal: 1,
        activeNowAnonymous: 0,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 0,
        websiteActiveNowAnonymous: 0,
        websiteActiveNowSignedIn: 0,
        communityActiveNowTotal: 1,
        totalBoardsSeen: 1,
        dailyActiveDevices: 1,
        weeklyActiveDevices: 1,
        monthlyActiveDevices: 1,
        updatedAt: expect.any(String),
      },
    });
  });

  it("tracks BE website presence separately, collapses multiple tabs by IP, and excludes website identities from Board device totals", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.upsertBeHomePresenceSession({
      sessionId: "be-home-session-1",
      deviceId: "raw-device-1",
      authState: "signed_in",
      deviceIdSource: "android_secure_android_id",
      clientVersion: "1.0.0",
      appEnvironment: "production",
    });

    const websiteResponse = await service.upsertBeWebsitePresenceSession(
      {
        sessionId: "website-session-1",
        authState: "anonymous",
        pagePath: "/browse?sort=featured",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );

    await service.upsertBeWebsitePresenceSession(
      {
        sessionId: "website-session-2",
        authState: "signed_in",
        pagePath: "/offerings",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );

    expect(websiteResponse).toEqual({
      accepted: true,
      session: {
        sessionId: "website-session-1",
        authState: "anonymous",
        lastSeenAt: expect.any(String),
        heartbeatIntervalSeconds: 300,
        activeTtlSeconds: 900,
      },
      metrics: {
        activeNowTotal: 1,
        activeNowAnonymous: 0,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 1,
        websiteActiveNowAnonymous: 1,
        websiteActiveNowSignedIn: 0,
        communityActiveNowTotal: 2,
        totalBoardsSeen: 1,
        dailyActiveDevices: 1,
        weeklyActiveDevices: 1,
        monthlyActiveDevices: 1,
        updatedAt: expect.any(String),
      },
    });
    expect(tables.be_home_presence_sessions).toHaveLength(3);
    expect(tables.be_home_presence_sessions[1]).toMatchObject({
      session_id: "website-session-1",
      auth_state: "anonymous",
      surface: "be_website",
      client_version: "/browse?sort=featured",
      device_id_source: "website_ip",
      ended_at: null,
    });
    expect(tables.be_home_device_identities).toHaveLength(2);
    expect(tables.be_home_device_identities[1]).toMatchObject({
      last_device_id_source: "website_ip",
      last_client_version: "/offerings",
    });
    expect(tables.be_home_presence_sessions[1]!.device_id_hash).toBe(tables.be_home_presence_sessions[2]!.device_id_hash);

    await expect(service.getBeHomeMetrics()).resolves.toEqual({
      metrics: {
        activeNowTotal: 1,
        activeNowAnonymous: 0,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 1,
        websiteActiveNowAnonymous: 0,
        websiteActiveNowSignedIn: 1,
        communityActiveNowTotal: 2,
        totalBoardsSeen: 1,
        dailyActiveDevices: 1,
        weeklyActiveDevices: 1,
        monthlyActiveDevices: 1,
        updatedAt: expect.any(String),
      },
    });
  });

  it("keeps a website session signed in after later anonymous passive updates until sign-out resets the session", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.touchBeWebsitePresenceSession(
      {
        sessionId: "website-session-1",
        authState: "signed_in",
        pagePath: "/player",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );

    tables.be_home_presence_sessions[0]!.last_seen_at = new Date(Date.now() - 61_000).toISOString();

    await service.touchBeWebsitePresenceSession(
      {
        sessionId: "website-session-1",
        authState: "anonymous",
        pagePath: "/browse",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );

    expect(tables.be_home_presence_sessions).toHaveLength(1);
    expect(tables.be_home_presence_sessions[0]).toMatchObject({
      session_id: "website-session-1",
      auth_state: "signed_in",
      client_version: "/browse",
      surface: "be_website",
    });

    await expect(service.getBeHomeMetrics()).resolves.toEqual({
      metrics: {
        activeNowTotal: 0,
        activeNowAnonymous: 0,
        activeNowSignedIn: 0,
        websiteActiveNowTotal: 1,
        websiteActiveNowAnonymous: 0,
        websiteActiveNowSignedIn: 1,
        communityActiveNowTotal: 1,
        totalBoardsSeen: 0,
        dailyActiveDevices: 0,
        weeklyActiveDevices: 0,
        monthlyActiveDevices: 0,
        updatedAt: expect.any(String),
      },
    });
  });

  it("throttles passive BE Home presence writes for the same session", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.touchBeHomePresenceSession({
      sessionId: "session-1",
      deviceId: "raw-device-1",
      authState: "anonymous",
      deviceIdSource: "install_id",
      clientVersion: "1.0.0",
      appEnvironment: "production",
    });

    const firstLastSeenAt = tables.be_home_presence_sessions[0]!.last_seen_at;
    const firstClientVersion = tables.be_home_device_identities[0]!.last_client_version;

    await service.touchBeHomePresenceSession({
      sessionId: "session-1",
      deviceId: "raw-device-1",
      authState: "anonymous",
      deviceIdSource: "install_id",
      clientVersion: "1.1.0",
      appEnvironment: "production",
    });

    expect(tables.be_home_presence_sessions).toHaveLength(1);
    expect(tables.be_home_device_identities).toHaveLength(1);
    expect(tables.be_home_presence_sessions[0]!.last_seen_at).toBe(firstLastSeenAt);
    expect(tables.be_home_device_identities[0]!.last_client_version).toBe(firstClientVersion);
  });

  it("throttles passive website presence writes for the same session", async () => {
    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await service.touchBeWebsitePresenceSession(
      {
        sessionId: "website-session-1",
        authState: "anonymous",
        pagePath: "/browse",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );

    const firstLastSeenAt = tables.be_home_presence_sessions[0]!.last_seen_at;
    const firstClientVersion = tables.be_home_device_identities[0]!.last_client_version;

    await service.touchBeWebsitePresenceSession(
      {
        sessionId: "website-session-1",
        authState: "anonymous",
        pagePath: "/offerings",
        appEnvironment: "production",
      },
      { countryCode: "US", ipAddress: "203.0.113.10" },
    );

    expect(tables.be_home_presence_sessions).toHaveLength(1);
    expect(tables.be_home_device_identities).toHaveLength(1);
    expect(tables.be_home_presence_sessions[0]!.last_seen_at).toBe(firstLastSeenAt);
    expect(tables.be_home_device_identities[0]!.last_client_version).toBe(firstClientVersion);
  });

  it("excludes stale and ended sessions from active metrics", async () => {
    const now = Date.now();
    tables.be_home_presence_sessions.push(
      {
        session_id: "session-active-anon",
        device_id_hash: "hash-1",
        auth_state: "anonymous",
        surface: "be_home",
        started_at: new Date(now - 120_000).toISOString(),
        last_seen_at: new Date(now - 20_000).toISOString(),
        ended_at: null,
        country_code: "US",
        client_version: "1.0.0",
        app_environment: "production",
        device_id_source: "install_id",
      },
      {
        session_id: "session-active-signed-in",
        device_id_hash: "hash-2",
        auth_state: "signed_in",
        surface: "be_home",
        started_at: new Date(now - 150_000).toISOString(),
        last_seen_at: new Date(now - 30_000).toISOString(),
        ended_at: null,
        country_code: "CA",
        client_version: "1.0.0",
        app_environment: "production",
        device_id_source: "android_secure_android_id",
      },
      {
        session_id: "session-stale",
        device_id_hash: "hash-3",
        auth_state: "anonymous",
        surface: "be_home",
        started_at: new Date(now - 500_000).toISOString(),
        last_seen_at: new Date(now - 400_000).toISOString(),
        ended_at: null,
        country_code: "GB",
        client_version: "1.0.0",
        app_environment: "production",
        device_id_source: "install_id",
      },
      {
        session_id: "session-ended",
        device_id_hash: "hash-4",
        auth_state: "signed_in",
        surface: "be_home",
        started_at: new Date(now - 200_000).toISOString(),
        last_seen_at: new Date(now - 10_000).toISOString(),
        ended_at: new Date(now - 5_000).toISOString(),
        country_code: "US",
        client_version: "1.0.0",
        app_environment: "production",
        device_id_source: "install_id",
      },
    );
    tables.be_home_device_identities.push(
      {
        device_id_hash: "hash-1",
        first_seen_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen_at: new Date(now - 20_000).toISOString(),
        first_country_code: "US",
        last_country_code: "US",
        last_client_version: "1.0.0",
        last_device_id_source: "install_id",
      },
      {
        device_id_hash: "hash-2",
        first_seen_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        first_country_code: "CA",
        last_country_code: "CA",
        last_client_version: "1.0.0",
        last_device_id_source: "android_secure_android_id",
      },
      {
        device_id_hash: "hash-3",
        first_seen_at: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        first_country_code: "GB",
        last_country_code: "GB",
        last_client_version: "1.0.0",
        last_device_id_source: "install_id",
      },
      {
        device_id_hash: "hash-4",
        first_seen_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        last_seen_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        first_country_code: "US",
        last_country_code: "US",
        last_client_version: "1.0.0",
        last_device_id_source: "install_id",
      },
    );

    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    await expect(service.getBeHomeMetrics()).resolves.toEqual({
      metrics: {
        activeNowTotal: 2,
        activeNowAnonymous: 1,
        activeNowSignedIn: 1,
        websiteActiveNowTotal: 0,
        websiteActiveNowAnonymous: 0,
        websiteActiveNowSignedIn: 0,
        communityActiveNowTotal: 2,
        totalBoardsSeen: 4,
        dailyActiveDevices: 1,
        weeklyActiveDevices: 2,
        monthlyActiveDevices: 3,
        updatedAt: expect.any(String),
      },
    });
  });

  it("marks a BE Home session as ended on best-effort disconnect", async () => {
    const now = Date.now();
    tables.be_home_presence_sessions.push({
      session_id: "session-1",
      device_id_hash: "hash-1",
      auth_state: "signed_in",
      surface: "be_home",
      started_at: new Date(now - 120_000).toISOString(),
      last_seen_at: new Date(now - 5_000).toISOString(),
      ended_at: null,
      country_code: "US",
      client_version: "1.0.0",
      app_environment: "production",
      device_id_source: "install_id",
    });
    tables.be_home_device_identities.push({
      device_id_hash: "hash-1",
      first_seen_at: new Date(now - 120_000).toISOString(),
      last_seen_at: new Date(now - 5_000).toISOString(),
      first_country_code: "US",
      last_country_code: "US",
      last_client_version: "1.0.0",
      last_device_id_source: "install_id",
    });

    const service = new WorkerAppService({
      APP_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    const response = await service.endBeHomePresenceSession({
      sessionId: "session-1",
    });

    expect(response).toEqual({
      accepted: true,
      session: {
        sessionId: "session-1",
        endedAt: expect.any(String),
      },
    });
    expect(tables.be_home_presence_sessions[0]!.ended_at).not.toBeNull();
    await expect(service.getBeHomeMetrics()).resolves.toEqual({
      metrics: {
        activeNowTotal: 0,
        activeNowAnonymous: 0,
        activeNowSignedIn: 0,
        websiteActiveNowTotal: 0,
        websiteActiveNowAnonymous: 0,
        websiteActiveNowSignedIn: 0,
        communityActiveNowTotal: 0,
        totalBoardsSeen: 1,
        dailyActiveDevices: 1,
        weeklyActiveDevices: 1,
        monthlyActiveDevices: 1,
        updatedAt: expect.any(String),
      },
    });
  });
});

describe("WorkerAppService.getContext", () => {
  it("defaults the typed storage buckets when they are not explicitly configured", () => {
    const service = new WorkerAppService({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
    });

    expect(service.getContext()).toMatchObject({
      supabaseAvatarsBucket: "avatars",
      supabaseCardImagesBucket: "card-images",
      supabaseHeroImagesBucket: "hero-images",
      supabaseLogoImagesBucket: "logo-images",
      deploySmokeSecret: null,
    });
  });

  it("respects explicit typed storage bucket overrides", () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      SUPABASE_AVATARS_BUCKET: "custom-avatars",
      SUPABASE_CARD_IMAGES_BUCKET: "custom-card-images",
      SUPABASE_HERO_IMAGES_BUCKET: "custom-hero-images",
      SUPABASE_LOGO_IMAGES_BUCKET: "custom-logo-images",
    });

    expect(service.getContext()).toMatchObject({
      supabaseAvatarsBucket: "custom-avatars",
      supabaseCardImagesBucket: "custom-card-images",
      supabaseHeroImagesBucket: "custom-hero-images",
      supabaseLogoImagesBucket: "custom-logo-images",
    });
  });

  it("normalizes deploy-smoke and integration placeholders as unset values", () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      BREVO_API_KEY: "optional-for-staging",
      BREVO_SIGNUPS_LIST_ID: "replace-me",
      TURNSTILE_SECRET_KEY: "replace-with-turnstile-secret",
      DEPLOY_SMOKE_SECRET: "replace-me",
    });

    expect(service.getContext()).toMatchObject({
      brevoApiKey: null,
      brevoSignupsListId: null,
      turnstileSecretKey: null,
      deploySmokeSecret: null,
    });
  });
});
