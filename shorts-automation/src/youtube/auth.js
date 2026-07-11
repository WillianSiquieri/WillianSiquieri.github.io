// Autenticação OAuth2 do YouTube.
//
// Duas formas de uso:
//  1) `npm run auth`  → fluxo interativo local para obter o REFRESH TOKEN uma vez.
//  2) getClient()     → usa YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN
//                       (secrets) para autenticar de forma não-interativa no CI.
import { google } from 'googleapis';
import { createServer } from 'node:http';
import { warn } from '../util.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

export function oauthClient() {
  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  const redirect = process.env.YT_REDIRECT_URI || 'http://localhost:8787/oauth2callback';
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirect);
}

// Cliente autenticado e pronto (usa refresh token). Retorna null se faltar credencial.
export function getAuth() {
  const oauth = oauthClient();
  if (!oauth) return null;
  const refreshToken = process.env.YT_REFRESH_TOKEN;
  if (!refreshToken) return null;
  oauth.setCredentials({ refresh_token: refreshToken });
  return oauth;
}

// Fluxo interativo (rodar localmente): abre URL de consentimento e captura o code.
async function interactiveAuth() {
  const oauth = oauthClient();
  if (!oauth) {
    console.error('Defina YT_CLIENT_ID e YT_CLIENT_SECRET antes de rodar o auth.');
    process.exit(1);
  }
  const url = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  console.log('\n1) Abra esta URL no navegador e autorize:\n\n' + url + '\n');

  const code = await new Promise((resolve) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, 'http://localhost:8787');
      const c = u.searchParams.get('code');
      if (c) {
        res.end('Autorizado! Pode fechar esta aba e voltar ao terminal.');
        server.close();
        resolve(c);
      } else {
        res.end('Aguardando código…');
      }
    });
    server.listen(8787);
  });

  const { tokens } = await oauth.getToken(code);
  console.log('\n✅ REFRESH TOKEN (guarde como secret YT_REFRESH_TOKEN):\n\n' + tokens.refresh_token + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  interactiveAuth().catch((e) => {
    warn(e.message);
    process.exit(1);
  });
}
