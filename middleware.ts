export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - Static assets (images, fonts, css, js, etc.)
     * - favicon.ico
     */
    '/((?!favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|css|js|map)).*)',
  ],
};

export default function middleware(request: Request) {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASS;

  // Skip auth if environment variables are not set (safety fallback)
  if (!basicAuthUser || !basicAuthPass) {
    return;
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    try {
      const authValue = authHeader.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      if (user === basicAuthUser && pwd === basicAuthPass) {
        return;
      }
    } catch {
      // Invalid auth header format
    }
  }

  // Return 401 with WWW-Authenticate header
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
