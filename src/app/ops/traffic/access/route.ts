import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  withRateLimit,
  type RateLimitContext,
} from "@/lib/api/with-rate-limit";
import { getRuntimeEnvString, isRuntimeProduction } from "@/lib/env";
import {
  createOpsAccessCookieValue,
  OPS_TRAFFIC_ACCESS_COOKIE_MAX_AGE_SECONDS,
  OPS_TRAFFIC_ACCESS_COOKIE_NAME,
} from "@/lib/ops/access-cookie";
import { constantTimeCompare } from "@/lib/security-crypto";

const SEE_OTHER_STATUS = 303;

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: SEE_OTHER_STATUS,
    headers: {
      Location: path,
    },
  });
}

async function handlePost(request: NextRequest, _context: RateLimitContext) {
  const secret = getRuntimeEnvString("OPS_DASHBOARD_ACCESS_KEY");
  const form = await request.formData();
  const accessKey = String(form.get("accessKey") ?? "");

  if (!secret || !constantTimeCompare(accessKey, secret)) {
    const response = redirectTo("/ops/traffic?access=denied");
    response.cookies.delete({
      name: OPS_TRAFFIC_ACCESS_COOKIE_NAME,
      path: "/ops/traffic",
    });
    return response;
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

export const POST = POST_RATE_LIMITED;
