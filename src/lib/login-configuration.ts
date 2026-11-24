export function requireLoginConfiguration() {
  const problems: string[] = [];
  if (!process.env.MONGODB_URI?.trim()) problems.push("MONGODB_URI is missing");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    problems.push("SESSION_SECRET must contain at least 32 characters");
  if (problems.length) {
    console.error("Login configuration error:", problems.join("; "));
    throw Object.assign(
      new Error("Sign-in is unavailable. Please contact support."),
      { status: 503 },
    );
  }
}
