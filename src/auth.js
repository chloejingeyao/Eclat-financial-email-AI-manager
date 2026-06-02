/**
 * auth.js — Local OAuth2 flow for Gmail access.
 * Run once: `npm run auth`
 * Saves token.json to project root for subsequent runs.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import open from 'open';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function loadToken(oauth2Client) {
  if (!fs.existsSync(TOKEN_PATH)) return false;
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oauth2Client.setCredentials(token);
  return true;
}

async function runAuthFlow() {
  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n=== Finance Sentinel — Gmail Auth ===');
  console.log('Opening your browser to authorize Gmail access...\n');

  // Start a local server to capture the OAuth callback
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:3000');
    const code = url.searchParams.get('code');

    if (!code) {
      res.end('No code found. Please try again.');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

      res.end('<h2>Authorization successful! You can close this tab.</h2>');
      console.log('✓ token.json saved. Auth complete.\n');
      server.close();
    } catch (err) {
      res.end('Error getting token: ' + err.message);
      console.error('Auth error:', err.message);
      server.close();
    }
  });

  server.listen(3000, () => {
    open(authUrl);
  });
}

// Only run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAuthFlow();
}
