import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  withRateLimit,
  type RateLimitContext,
} from "@/lib/api/with-rate-limit";
import { HTTP_SERVICE_UNAVAILABLE, HTTP_TOO_MANY_REQUESTS } from "@/constants";
import { getRuntimeEnvString, isRuntimeProduction } from "@/lib/env";
import {
  createOpsAccessCookieValue,
  OPS_TRAFFIC_ACCESS_COOKIE_MAX_AGE_SECONDS,
  OPS_TRAFFIC_ACCESS_COOKIE_NAME,
} from "@/lib/ops/access-cookie";
import { constantTimeCompare } from "@/lib/security-crypto";

const SEE_OTHER_STATUS = 303;
const RATE_LIMIT_HEADER_NAMES = [
  "retry-after",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-ratelimit-degraded",
] as const;

function redirectTo(path: string, headers?: Headers) {
  return new NextResponse(null, {
    status: SEE_OTHER_STATUS,
    headers: {
      ...Object.fromEntries(headers?.entries() ?? []),
      Location: path,
    },
  });
}

function redirectToDenied(headers?: Headers) {
  const response = redirectTo("/ops/traffic?access=denied", headers);
  response.cookies.delete({
    name: OPS_TRAFFIC_ACCESS_COOKIE_NAME,
    path: "/ops/traffic",
  });
  return response;
}

function copyRateLimitHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const headerName of RATE_LIMIT_HEADER_NAMES) {
    const value = source.get(headerName);
    if (value) headers.set(headerName, value);
  }
  return headers;
}

async function handlePost(request: NextRequest, _context: RateLimitContext) {
  const secret = getRuntimeEnvString("OPS_DASHBOARD_ACCESS_KEY");
  const form = await request.formData();
  const accessKey = String(form.get("accessKey") ?? "");

  if (!secret || !constantTimeCompare(accessKey, secret)) {
    return redirectToDenied();
  }

  const response = redirectTo("/ops/traffic");
  response.cookies.set({
    name: OPS_TRAFFIC_ACCESS_COOKIE_NAME,
    value: await createOpsAccessCookieValue({ secret }),
    httpOnly: true,
    sameSite: "strict",
    secure: isRuntimeProduction(),
    path: "/ops/traffic",
    maxAge: OPS_TRAFFIC_ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

const POST_RATE_LIMITED = withRateLimit("opsAccess", handlePost);

export async function POST(request: NextRequest) {
  const response = await POST_RATE_LIMITED(request);
  if (
    response.status === HTTP_TOO_MANY_REQUESTS ||
    response.status === HTTP_SERVICE_UNAVAILABLE
  ) {
    return redirectToDenied(copyRateLimitHeaders(response.headers));
  }
  return response;
}
