const backendUrl = process.env.BACKEND_URL?.trim();

if (!backendUrl) {
  throw new Error("Set BACKEND_URL to the deployed Backend origin in the Vercel project.");
}

const backend = new URL(backendUrl);
if (backend.protocol !== "https:" || backend.username || backend.password ||
    backend.pathname !== "/" || backend.search || backend.hash) {
  throw new Error("BACKEND_URL must be an HTTPS origin without a path, query, or credentials.");
}

export const config = {
  framework: "vite",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites: [
    { source: "/api/:path*", destination: `${backend.origin}/api/:path*` },
    { source: "/((?!api/|assets/).*)", destination: "/index.html" },
  ],
};
