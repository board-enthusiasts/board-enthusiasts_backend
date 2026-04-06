import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const bootstrapRoles = ["player", "developer", "verified_developer", "moderator", "admin", "super_admin"] as const;

interface ParsedArgs {
  [key: string]: string | undefined;
}

interface BootstrapOptions {
  supabaseUrl: string;
  secretKey: string;
  email: string;
  password: string;
  userName: string;
  displayName: string;
  firstName: string;
  lastName: string;
}

interface AuthUserRecord {
  id: string;
  email: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function requireArg(args: ParsedArgs, name: string): string {
  const value = (args[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required argument --${name}`);
  }

  return value;
}

function sanitizeUserName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function buildOptions(argv: string[]): BootstrapOptions {
  const args = parseArgs(argv);
  const email = requireArg(args, "email").toLowerCase();
  if ((args.password ?? "").trim()) {
    throw new Error("The bootstrap super-admin script no longer accepts --password. Pipe the password over stdin instead.");
  }
  if ((args["password-stdin"] ?? "").trim().toLowerCase() != "true") {
    throw new Error("Missing required argument --password-stdin.");
  }
  const userName = sanitizeUserName(args["user-name"] ?? email.split("@")[0] ?? "admin");
  if (!userName) {
    throw new Error("Unable to derive a valid --user-name for the bootstrap super admin.");
  }

  return {
    supabaseUrl: requireArg(args, "supabase-url"),
    secretKey: requireArg(args, "secret-key"),
    email,
    password: "",
    userName,
    displayName: requireArg(args, "display-name"),
    firstName: requireArg(args, "first-name"),
    lastName: requireArg(args, "last-name"),
  };
}

async function readPasswordFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }

  const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  if (!password.trim()) {
    throw new Error("Bootstrap password was not provided on stdin.");
  }

  return password;
}

async function findAuthUserByEmail(client: SupabaseClient, email: string): Promise<AuthUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const found = (data.users ?? []).find((candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail);
    if (found?.id && found.email) {
      return { id: found.id, email: found.email };
    }

    if ((data.users ?? []).length < perPage) {
      break;
    }
  }

  return null;
}

async function ensureAuthUser(client: SupabaseClient, options: BootstrapOptions): Promise<AuthUserRecord> {
  const metadata = {
    userName: options.userName,
    displayName: options.displayName,
    firstName: options.firstName,
    lastName: options.lastName,
  };
  const existing = await findAuthUserByEmail(client, options.email);
  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing.id, {
      email: options.email,
      password: options.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) {
      throw error;
    }

    return existing;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user?.id || !data.user.email) {
    throw error ?? new Error("Failed to create the bootstrap super-admin auth user.");
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

async function ensureProjectedUser(client: SupabaseClient, authUser: AuthUserRecord, options: BootstrapOptions): Promise<string> {
  const now = new Date().toISOString();
  const { error: upsertError } = await client
    .from("app_users")
    .upsert(
      {
        auth_user_id: authUser.id,
        user_name: options.userName,
        display_name: options.displayName,
        first_name: options.firstName,
        last_name: options.lastName,
        email: options.email,
        email_verified: true,
        identity_provider: "email",
        avatar_url: null,
        avatar_storage_path: null,
        brevo_contact_id: null,
        brevo_sync_state: "pending",
        brevo_synced_at: null,
        brevo_last_error: null,
        updated_at: now,
      },
      { onConflict: "auth_user_id" },
    );
  if (upsertError) {
    throw upsertError;
  }

  const { data, error } = await client
    .from("app_users")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .single();
  if (error || !data?.id) {
    throw error ?? new Error("Failed to read back the bootstrap super-admin application user.");
  }

  return String(data.id);
}

async function ensureRoles(client: SupabaseClient, appUserId: string): Promise<void> {
  const roleRows = bootstrapRoles.map((role) => ({ user_id: appUserId, role }));
  const { error } = await client.from("app_user_roles").upsert(roleRows, {
    onConflict: "user_id,role",
    ignoreDuplicates: true,
  });
  if (error) {
    throw error;
  }
}

async function main(): Promise<void> {
  const options = buildOptions(process.argv.slice(2));
  options.password = await readPasswordFromStdin();
  const client = createClient(options.supabaseUrl, options.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authUser = await ensureAuthUser(client, options);
  const appUserId = await ensureProjectedUser(client, authUser, options);
  await ensureRoles(client, appUserId);

  console.log("==> Super-admin bootstrap complete");
  console.log(`Email: ${options.email}`);
  console.log(`User name: ${options.userName}`);
  console.log(`Roles: ${bootstrapRoles.join(", ")}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Super-admin bootstrap failed: ${message}`);
  process.exitCode = 1;
});
