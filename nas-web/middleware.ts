import { NextResponse, type NextRequest } from "next/server";

const AUTH_BACKEND = process.env.AUTH_BACKEND || "http://127.0.0.1:8080";

const AUTH_PATHS = ["/login", "/register", "/device-info", "/ping", "/validate-token"];

/**
 * Middleware — 开发模式 API 代理
 *
 *  /api/*     → 全部 fetch 转发到 authd
 *  /login 等  → POST/PUT/DELETE fetch 转发；GET 渲染页面
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return forwardToAuthd(request);
  }

  if (AUTH_PATHS.includes(pathname) && request.method !== "GET" && request.method !== "HEAD") {
    return forwardToAuthd(request);
  }

  return NextResponse.next();
}

async function forwardToAuthd(request: NextRequest): Promise<Response> {
  const url = `${AUTH_BACKEND}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (lower === "host" || lower === "connection") return;
    forwardHeaders.set(k, v);
  });

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

  try {
    const res = await fetch(url, {
      method: request.method,
      headers: forwardHeaders,
      body,
      duplex: body ? "half" : undefined,
    } as RequestInit);

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch {
    return NextResponse.json(
      { error: "后端服务不可用" },
      { status: 503 },
    );
  }
}

export const config = {
  matcher: ["/api/:path*", "/login", "/register", "/device-info", "/ping", "/validate-token"],
};
