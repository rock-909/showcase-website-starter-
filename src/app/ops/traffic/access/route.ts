import "server-only";

import { NextResponse } from "next/server";
import { getRuntimeEnvString, isRuntimeProduction } from "@/lib/env";
import {
  createOpsAccessCookieValue,
  OPS_TRAFFIC_ACCESS_COOKIE_MAX_AGE_SECONDS,
  OPS_TRAFFIC_ACCESS_COOKIE_NAME,
} from "@/lib/ops/access-cookie";

const SEE_OTHER_STATUS = 303;

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: SEE_OTHER_STATUS,
    headers: {
      Location: path,
    },
  });
}

export async function POST(request: Request) {
  const secret = getRuntimeEnvString("OPS_DASHBOARD_ACCESS_KEY");
  const form = await request.formData();
  const accessKey = String(form.get("accessKey") ?? "");

  if (!secret || accessKey !== secret) {
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
