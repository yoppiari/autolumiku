export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HomePage() {
  // Return null and use meta refresh for redirect
  // This avoids calling redirect() which might fail during build
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="0;url=/login" />
      </head>
      <body>
        <p>Redirecting...</p>
      </body>
    </html>
  );
}
