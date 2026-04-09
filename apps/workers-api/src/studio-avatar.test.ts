import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerAppService } from "./service-boundary";

type AppUserRow = {
  id: string;
  auth_user_id: string;
  user_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_verified: boolean;
  identity_provider: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  updated_at: string;
};

type AppUserRoleRow = {
  user_id: string;
  role: string;
};

type StudioRow = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  banner_url: string | null;
  banner_storage_path: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

type StudioMembershipRow = {
  studio_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor";
  joined_at?: string;
  updated_at?: string;
};

type StudioLinkRow = {
  id: string;
  studio_id: string;
  label: string;
  url: string;
  created_at: string;
  updated_at: string;
};

type PlayerFollowedStudioRow = {
  user_id: string;
  studio_id: string;
  created_at: string;
};

type CatalogMediaTypeDefinitionRow = {
  key: string;
  owner_kind: "studio" | "title";
  display_name: string;
  usage_summary: string;
  bucket_name: string;
  max_upload_bytes: number;
  accepted_mime_types: string[];
  accepted_file_types: string[];
  recommended_width: number;
  recommended_height: number;
  aspect_width: number;
  aspect_height: number;
  allows_multiple: boolean;
  supports_video: boolean;
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
  preview_image_url: string | null;
  preview_storage_path: string | null;
  video_url: string | null;
  alt_text: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

const tables: {
  app_users: AppUserRow[];
  app_user_roles: AppUserRoleRow[];
  studios: StudioRow[];
  studio_memberships: StudioMembershipRow[];
  studio_links: StudioLinkRow[];
  player_followed_studios: PlayerFollowedStudioRow[];
  catalog_media_type_definitions: CatalogMediaTypeDefinitionRow[];
  catalog_media_entries: CatalogMediaEntryRow[];
} = {
  app_users: [],
  app_user_roles: [],
  studios: [],
  studio_memberships: [],
  studio_links: [],
  player_followed_studios: [],
  catalog_media_type_definitions: [],
  catalog_media_entries: [],
};

const storageUploads: Array<{ bucket: string; path: string; contentType: string }> = [];

function resetTables() {
  tables.app_users = [
    {
      id: "user-1",
      auth_user_id: "auth-user-1",
      user_name: "taylor",
      display_name: "Taylor",
      first_name: "Taylor",
      last_name: null,
      email: "taylor@example.com",
      email_verified: true,
      identity_provider: "email",
      avatar_url: null,
      avatar_storage_path: null,
      updated_at: "2026-03-13T00:00:00Z",
    },
  ];
  tables.app_user_roles = [
    { user_id: "user-1", role: "player" },
    { user_id: "user-1", role: "developer" },
  ];
  tables.studios = [
    {
      id: "studio-1",
      slug: "blue-harbor-games",
      display_name: "Blue Harbor Games",
      description: "Blue Harbor Games profile.",
      avatar_url: null,
      avatar_storage_path: null,
      logo_url: "https://cdn.example/logo.png",
      logo_storage_path: "studios/blue-harbor-games/logo.png",
      banner_url: null,
      banner_storage_path: null,
      created_by_user_id: "user-1",
      created_at: "2026-03-13T00:00:00Z",
      updated_at: "2026-03-13T00:00:00Z",
    },
  ];
  tables.studio_memberships = [{ studio_id: "studio-1", user_id: "user-1", role: "owner" }];
  tables.studio_links = [];
  tables.player_followed_studios = [];
  tables.catalog_media_type_definitions = [
    {
      key: "studio_avatar",
      owner_kind: "studio",
      display_name: "Studio avatar",
      usage_summary: "Avatar shown on studio cards and details.",
      bucket_name: "avatars",
      max_upload_bytes: 5_000_000,
      accepted_mime_types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
      accepted_file_types: ["PNG", "JPG", "WEBP", "SVG"],
      recommended_width: 512,
      recommended_height: 512,
      aspect_width: 1,
      aspect_height: 1,
      allows_multiple: false,
      supports_video: false,
      created_at: "2026-03-13T00:00:00Z",
      updated_at: "2026-03-13T00:00:00Z",
    },
    {
      key: "studio_logo",
      owner_kind: "studio",
      display_name: "Studio logo",
      usage_summary: "Logo shown on studio surfaces.",
      bucket_name: "logo-images",
      max_upload_bytes: 5_000_000,
      accepted_mime_types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
      accepted_file_types: ["PNG", "JPG", "WEBP", "SVG"],
      recommended_width: 1200,
      recommended_height: 400,
      aspect_width: 1,
      aspect_height: 1,
      allows_multiple: false,
      supports_video: false,
      created_at: "2026-03-13T00:00:00Z",
      updated_at: "2026-03-13T00:00:00Z",
    },
    {
      key: "studio_banner",
      owner_kind: "studio",
      display_name: "Studio banner",
      usage_summary: "Banner shown on studio details.",
      bucket_name: "hero-images",
      max_upload_bytes: 5_000_000,
      accepted_mime_types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
      accepted_file_types: ["PNG", "JPG", "WEBP", "SVG"],
      recommended_width: 1680,
      recommended_height: 720,
      aspect_width: 3,
      aspect_height: 1,
      allows_multiple: false,
      supports_video: false,
      created_at: "2026-03-13T00:00:00Z",
      updated_at: "2026-03-13T00:00:00Z",
    },
  ];
  tables.catalog_media_entries = [];
  storageUploads.splice(0, storageUploads.length);
}

function createQueryBuilder(tableName: keyof typeof tables) {
  let filters: Array<{ column: string; value: unknown }> = [];
  let inFilter: { column: string; values: unknown[] } | null = null;
  let pendingUpdate: Record<string, unknown> | null = null;
  let pendingSelect: string | null = null;
  let orderBy: Array<{ column: string; ascending: boolean }> = [];

  const applyFilters = <TRow extends Record<string, unknown>>(rows: TRow[]) => {
    const filtered = rows.filter((row) => {
      const matchesEq = filters.every((filter) => row[filter.column] === filter.value);
      const matchesIn = inFilter ? inFilter.values.includes(row[inFilter.column]) : true;
      return matchesEq && matchesIn;
    });

    if (orderBy.length === 0) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      for (const order of orderBy) {
        const leftValue = left[order.column];
        const rightValue = right[order.column];

        if (leftValue === rightValue) {
          continue;
        }
        if (leftValue == null) {
          return order.ascending ? -1 : 1;
        }
        if (rightValue == null) {
          return order.ascending ? 1 : -1;
        }

        const comparison = String(leftValue).localeCompare(String(rightValue));
        if (comparison !== 0) {
          return order.ascending ? comparison : -comparison;
        }
      }

      return 0;
    });
  };

  const builder = {
    select(columns?: string) {
      pendingSelect = columns ?? null;
      return builder;
    },
    then(onFulfilled: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve({
        data: applyFilters(tables[tableName] as Array<Record<string, unknown>>),
        error: null,
      }).then(onFulfilled, onRejected);
    },
    in(column: string, values: unknown[]) {
      inFilter = { column, values };
      return Promise.resolve({
        data: applyFilters(tables[tableName] as Array<Record<string, unknown>>),
        error: null,
      });
    },
    order(column: string, options?: { ascending?: boolean }) {
      orderBy = [...orderBy, { column, ascending: options?.ascending ?? true }];
      return builder;
    },
    limit(count: number) {
      return Promise.resolve({
        data: applyFilters(tables[tableName] as Array<Record<string, unknown>>).slice(0, count),
        error: null,
      });
    },
    single() {
      const rows = applyFilters(tables[tableName] as Array<Record<string, unknown>>);
      return Promise.resolve({
        data: rows[0] ?? null,
        error: null,
      });
    },
    eq(column: string, value: unknown) {
      filters = [...filters, { column, value }];
      if (pendingUpdate) {
        for (const row of applyFilters(tables[tableName] as Array<Record<string, unknown>>)) {
          Object.assign(row, pendingUpdate);
        }

        return Promise.resolve({ error: null });
      }

      return builder;
    },
    insert(payload: Array<Record<string, unknown>> | Record<string, unknown>) {
      const rows = Array.isArray(payload) ? payload : [payload];
      const destination = tables[tableName] as Array<Record<string, unknown>>;
      const inserted = rows.map((row, index) => {
        const copy = { ...row };
        if (!copy.id) {
          copy.id = `${tableName.slice(0, -1)}-${destination.length + index + 1}`;
        }
        return copy;
      });
      destination.push(...inserted);

      return {
        select() {
          return {
            single: async () => ({ data: inserted[0] ?? null, error: null }),
          };
        },
        then(onFulfilled: (value: { error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
        },
      };
    },
    update(payload: Record<string, unknown>) {
      pendingUpdate = payload;
      return builder;
    },
    delete() {
      const deleteFilters: Array<{ column: string; value: unknown }> = [];
      return {
        eq(column: string, value: unknown) {
          deleteFilters.push({ column, value });
          if (deleteFilters.length < 2) {
            return this;
          }

          const kept = (tables[tableName] as Array<Record<string, unknown>>).filter((row) =>
            !deleteFilters.every((filter) => row[filter.column] === filter.value),
          );
          tables[tableName].splice(0, tables[tableName].length, ...(kept as never[]));
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return builder;
}

const authGetUser = vi.fn(async () => ({
  data: {
    user: {
      id: "auth-user-1",
      email: "taylor@example.com",
      email_confirmed_at: "2026-03-13T00:00:00Z",
      user_metadata: { displayName: "Taylor" },
      app_metadata: { provider: "email" },
      identities: [{ provider: "email" }],
    },
  },
  error: null,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: authGetUser,
    },
    from(tableName: keyof typeof tables) {
      return createQueryBuilder(tableName);
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File, options: { contentType: string }) {
            storageUploads.push({ bucket, path, contentType: options.contentType });
            return { error: null };
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: `https://storage.example/${bucket}/${path}`,
              },
            };
          },
        };
      },
    },
  })),
}));

describe("WorkerAppService studio avatar support", () => {
  beforeEach(() => {
    resetTables();
    vi.clearAllMocks();
  });

  it("creates and updates studios without mutating legacy media columns directly", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      SUPABASE_AVATARS_BUCKET: "avatars",
      SUPABASE_CARD_IMAGES_BUCKET: "card-images",
      SUPABASE_HERO_IMAGES_BUCKET: "hero-images",
      SUPABASE_LOGO_IMAGES_BUCKET: "logo-images",
    });

    const created = await service.createStudio("developer-token", {
      slug: "signal-harbor-studio",
      displayName: "Signal Harbor Studio",
      description: "A coastal co-op studio profile.",
    });

    expect(created.studio.avatarUrl ?? null).toBeNull();
    const createdStudioRow = tables.studios.find((studio) => studio.id === created.studio.id);
    expect(createdStudioRow?.avatar_url ?? null).toBeNull();
    expect(createdStudioRow?.logo_url ?? null).toBeNull();
    expect(createdStudioRow?.banner_url ?? null).toBeNull();

    const updated = await service.updateStudio("developer-token", "studio-1", {
      slug: "blue-harbor-games",
      displayName: "Blue Harbor Games",
      description: "Blue Harbor Games profile.",
    });

    expect(updated.studio.logoUrl).toBe("https://cdn.example/logo.png");
    expect(tables.studios.find((studio) => studio.id === "studio-1")).toMatchObject({
      avatar_url: null,
      logo_url: "https://cdn.example/logo.png",
      banner_url: null,
    });
  });

  it("projects studio catalog media into the legacy studio media columns for compatibility", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      SUPABASE_AVATARS_BUCKET: "avatars",
      SUPABASE_CARD_IMAGES_BUCKET: "card-images",
      SUPABASE_HERO_IMAGES_BUCKET: "hero-images",
      SUPABASE_LOGO_IMAGES_BUCKET: "logo-images",
    });

    const created = await service.createStudioCatalogMedia("developer-token", "studio-1", {
      mediaTypeKey: "studio_avatar",
      kind: "image",
      sourceUrl: "https://example.com/avatar.png",
      altText: null,
      mimeType: null,
      width: null,
      height: null,
      displayOrder: 0,
    });

    expect(created.mediaEntry.sourceUrl).toBe("https://example.com/avatar.png");
    expect(tables.studios.find((studio) => studio.id === "studio-1")?.avatar_url).toBe("https://example.com/avatar.png");

    await service.deleteStudioCatalogMedia("developer-token", "studio-1", created.mediaEntry.id);

    expect(tables.studios.find((studio) => studio.id === "studio-1")?.avatar_url).toBeNull();
  });

  it("uploads studio avatar files into storage and updates the studio projection", async () => {
    const service = new WorkerAppService({
      APP_ENV: "staging",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      SUPABASE_AVATARS_BUCKET: "avatars",
      SUPABASE_CARD_IMAGES_BUCKET: "card-images",
      SUPABASE_HERO_IMAGES_BUCKET: "hero-images",
      SUPABASE_LOGO_IMAGES_BUCKET: "logo-images",
    });

    const response = await service.uploadStudioMedia(
      "developer-token",
      "studio-1",
      "avatar",
      new File(["avatar-bytes"], "studio-avatar.png", { type: "image/png" }),
    );

    expect(storageUploads).toEqual([
      expect.objectContaining({
        bucket: "avatars",
        path: "studios/blue-harbor-games/avatar.png",
        contentType: "image/png",
      }),
    ]);
    expect(response.studio.avatarUrl).toBe("https://storage.example/avatars/studios/blue-harbor-games/avatar.png");
    expect(tables.studios.find((studio) => studio.id === "studio-1")?.avatar_storage_path).toBe("studios/blue-harbor-games/avatar.png");
  });
});
