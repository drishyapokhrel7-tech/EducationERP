#!/usr/bin/env node
/**
 * One-time setup script (Phase 7h — Documents & Certificates storage).
 * Run this once to obtain a refresh token for the Google Drive
 * storage driver. It never runs as part of the app itself.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-drive-get-refresh-token.js
 *
 * The redirect URI below (http://localhost:4500/oauth2callback) must
 * be added as an "Authorized redirect URI" on this OAuth client in
 * Google Cloud Console (APIs & Services -> Credentials -> your OAuth
 * client -> Authorized redirect URIs) before running this.
 *
 * This opens a local server, prints a URL for YOU to open in YOUR OWN
 * browser (already signed into the Google account that should own
 * the Drive storage), and waits for the redirect back with an
 * authorization code, which it exchanges for a refresh token.
 */
const http = require("http");
const { google } = require("googleapis");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:4500/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// drive.file, not the broad "drive" scope — the app can only ever
// see/manage files it creates itself, never anything else already in
// the account's Drive. Narrowest scope that does the job.
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces a refresh_token even on a re-auth
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

console.log("\nOpen this URL in YOUR OWN browser (signed into the Google account\nthat should store these documents) and approve access:\n");
console.log(authUrl);
console.log("\nWaiting for the redirect back to localhost:4500 ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("No authorization code in the callback.");
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Done — you can close this tab and check the terminal.");
    if (tokens.refresh_token) {
      console.log("Success. Add this to services/api/.env:\n");
      console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
    } else {
      console.log(
        "No refresh_token came back — this Google account may already have an\nactive grant for this app. Revoke it at https://myaccount.google.com/permissions\nand run this script again.",
      );
    }
  } catch (err) {
    console.error("Token exchange failed:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Token exchange failed — check the terminal.");
  } finally {
    server.close();
  }
});

server.listen(4500);
