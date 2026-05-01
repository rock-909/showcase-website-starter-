import { NextResponse } from "next/server";

function goodErrorCodeResponse() {
  // ok: api-route-free-text-error-response
  return NextResponse.json(
    { success: false, errorCode: API_ERROR_CODES.UNAUTHORIZED },
    { status: 401 },
  );
}

function badFreeTextErrorResponse() {
  // ruleid: api-route-free-text-error-response
  return NextResponse.json(
    { success: false, error: "bad request" },
    { status: 400 },
  );
}

function badFreeTextMessageResponse() {
  // ruleid: api-route-free-text-error-response
  return NextResponse.json({ message: "unauthorized" }, { status: 401 });
}

function goodSharedHelperResponse() {
  // ok: api-route-free-text-error-response
  return createApiErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 401);
}
