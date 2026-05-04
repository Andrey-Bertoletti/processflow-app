import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Rotas públicas
  const publicRoutes = ["/auth/login", "/auth/register"];

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Se for rota pública, deixa passar
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Para rotas protegidas, verifica se tem token
  // (Supabase armazena token em cookie automaticamente)
  const authToken = request.cookies.get("sb-auth-token");

  if (!authToken && !pathname.startsWith("/")) {
    // Redireciona para login se não tiver token
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

// Configurar quais rotas usar middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
