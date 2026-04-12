import type { ProblemDetails, ValidationProblemDetails } from "@board-enthusiasts/migration-contract";

interface BeCommunityMetricsHeaders {
  activeNowTotal: number;
  activeNowAnonymous: number;
  activeNowSignedIn: number;
  websiteActiveNowTotal: number;
  websiteActiveNowAnonymous: number;
  websiteActiveNowSignedIn: number;
  communityActiveNowTotal: number;
  totalBoardsSeen: number;
  dailyActiveDevices: number;
  weeklyActiveDevices: number;
  monthlyActiveDevices: number;
  updatedAt: string;
}

const exposedCommunityMetricsHeaderNames = [
  "x-be-active-now-total",
  "x-be-active-now-anonymous",
  "x-be-active-now-signed-in",
  "x-be-website-active-now-total",
  "x-be-website-active-now-anonymous",
  "x-be-website-active-now-signed-in",
  "x-be-community-active-now-total",
  "x-be-total-boards-seen",
  "x-be-daily-active-devices",
  "x-be-weekly-active-devices",
  "x-be-monthly-active-devices",
  "x-be-metrics-updated-at",
] as const;

export class ApiError extends Error {
  status: number;
  payload: ProblemDetails | ValidationProblemDetails;

  constructor(status: number, payload: ProblemDetails | ValidationProblemDetails) {
    super(payload.title);
    this.status = status;
    this.payload = payload;
  }
}

export function corsHeaders(
  origin?: string | null,
  requestedHeaders?: string | null,
  communityMetrics?: BeCommunityMetricsHeaders | null,
): HeadersInit {
  const allowOrigin = origin && origin.trim().length > 0 ? origin : "*";
  const allowHeaders = new Set([
    "authorization",
    "content-type",
    "accept",
    "x-be-accept-community-metrics",
    "x-be-website-session-id",
    "x-be-website-auth-state",
    "x-be-page-path",
    "x-be-home-session-id",
    "x-be-home-device-id",
    "x-be-home-device-id-source",
    "x-be-home-auth-state",
    "x-be-home-client-version",
    "x-be-home-app-environment",
  ]);

  for (const header of (requestedHeaders ?? "").split(",")) {
    const trimmed = header.trim();
    if (trimmed) {
      allowHeaders.add(trimmed);
    }
  }

  const headers: Record<string, string> = {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": Array.from(allowHeaders).join(","),
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    pragma: "no-cache",
    expires: "0",
    vary: "Origin"
  };

  if (communityMetrics) {
    headers["access-control-expose-headers"] = exposedCommunityMetricsHeaderNames.join(",");
    headers["x-be-active-now-total"] = `${communityMetrics.activeNowTotal}`;
    headers["x-be-active-now-anonymous"] = `${communityMetrics.activeNowAnonymous}`;
    headers["x-be-active-now-signed-in"] = `${communityMetrics.activeNowSignedIn}`;
    headers["x-be-website-active-now-total"] = `${communityMetrics.websiteActiveNowTotal}`;
    headers["x-be-website-active-now-anonymous"] = `${communityMetrics.websiteActiveNowAnonymous}`;
    headers["x-be-website-active-now-signed-in"] = `${communityMetrics.websiteActiveNowSignedIn}`;
    headers["x-be-community-active-now-total"] = `${communityMetrics.communityActiveNowTotal}`;
    headers["x-be-total-boards-seen"] = `${communityMetrics.totalBoardsSeen}`;
    headers["x-be-daily-active-devices"] = `${communityMetrics.dailyActiveDevices}`;
    headers["x-be-weekly-active-devices"] = `${communityMetrics.weeklyActiveDevices}`;
    headers["x-be-monthly-active-devices"] = `${communityMetrics.monthlyActiveDevices}`;
    headers["x-be-metrics-updated-at"] = communityMetrics.updatedAt;
  }

  return headers;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

export function empty(status = 204): Response {
  return new Response(null, { status });
}

export function problem(
  status: number,
  code: string,
  title: string,
  detail: string,
  type = `https://boardtpl.dev/problems/${code}`
): ApiError {
  return new ApiError(status, {
    type,
    title,
    status,
    detail,
    code
  });
}

export function validationProblem(errors: Record<string, string[]>, title = "One or more validation errors occurred."): ApiError {
  return new ApiError(422, {
    title,
    status: 422,
    errors
  });
}
