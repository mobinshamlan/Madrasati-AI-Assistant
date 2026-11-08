import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { directDemoAllowed } from "@/lib/tammeni/direct-demo";
import { crossOriginWriteRefused, operatorCredentialsValid } from "@/lib/tammeni/operator-access";

export function proxy(request: NextRequest) {
  if (directDemoAllowed(process.env, request.headers)) return NextResponse.next();

  if (crossOriginWriteRefused(request.method, request.headers)) {
    return Response.json({ error: "طلب غير مسموح من موقع آخر." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!operatorCredentialsValid(process.env, request.headers.get("authorization"))) {
    return Response.json(
      { error: "يلزم تسجيل دخول المشغّل." },
      { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Tammeni operator", charset="UTF-8"', "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/demo-control", "/api/demo-control/:path*"],
};
