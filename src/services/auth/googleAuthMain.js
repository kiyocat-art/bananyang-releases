'use strict';

/**
 * googleAuthMain.js
 * Google Cloud Application Default Credentials (ADC) 인증 모듈
 * Main Process (Node.js) 전용 — Renderer에서 직접 require 금지
 *
 * gcloud Desktop OAuth2 Client를 사용하여 브라우저 인증 후 ADC 파일 생성.
 * 생성된 ADC 파일은 @google-cloud/vertexai SDK가 자동으로 인식함.
 * AI Studio용 인증은 ADC 파일을 건드리지 않고 별도 처리.
 */

const { OAuth2Client, GoogleAuth } = require('google-auth-library');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ── gcloud SDK 공개 Desktop OAuth2 클라이언트 ──────────────────────────────
// Google Cloud SDK 바이너리에 공개적으로 포함된 값 (Desktop App 타입이므로 공개 설계)
// Desktop 타입이므로 localhost 임의 포트 redirect 허용 → 별도 URI 등록 불필요
const GCLOUD_CLIENT_ID =
  '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
const GCLOUD_CLIENT_SECRET = 'd-FL95Q19q7MQmFpd7hHD0Ty';

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
];

// ── ADC 파일 경로 (OS별 well-known location) ──────────────────────────────
const ADC_PATH =
  process.platform === 'win32'
    ? path.join(
        process.env.APPDATA || os.homedir(),
        'gcloud',
        'application_default_credentials.json'
      )
    : path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');

// ── 진행 중인 OAuth 플로우 취소 핸들 ─────────────────────────────────────
let _currentFinishVertex = null;

// ── ADC 파일 읽기 ─────────────────────────────────────────────────────────
function readAdcFile() {
  try {
    if (fs.existsSync(ADC_PATH)) {
      return JSON.parse(fs.readFileSync(ADC_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('[GoogleAuth] ADC 파일 읽기 실패:', e.message);
  }
  return null;
}

// ── ADC 파일 쓰기 (원자적) ────────────────────────────────────────────────
function writeAdcFile(refreshToken, projectId) {
  const dir = path.dirname(ADC_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const adcContent = {
    account: '',
    client_id: GCLOUD_CLIENT_ID,
    client_secret: GCLOUD_CLIENT_SECRET,
    quota_project_id: projectId || '',
    refresh_token: refreshToken,
    type: 'authorized_user',
    universe_domain: 'googleapis.com',
  };

  const tmpPath = ADC_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(adcContent, null, 2), 'utf-8');
  fs.renameSync(tmpPath, ADC_PATH);
  console.log('[GoogleAuth] ADC 파일 저장:', ADC_PATH);
}

// ── ADC 파일 삭제 ─────────────────────────────────────────────────────────
function deleteAdcFile() {
  try {
    if (fs.existsSync(ADC_PATH)) {
      fs.unlinkSync(ADC_PATH);
      console.log('[GoogleAuth] ADC 파일 삭제 완료');
    }
  } catch (e) {
    console.warn('[GoogleAuth] ADC 파일 삭제 실패:', e.message);
  }
}

// ── ADC 상태 확인 ─────────────────────────────────────────────────────────
function checkAdcStatus() {
  const adc = readAdcFile();
  if (!adc) return { hasAdc: false };
  return {
    hasAdc: true,
    type: adc.type || 'authorized_user',
    projectId: adc.quota_project_id || null,
  };
}

// ── 프로젝트 ID 업데이트 ──────────────────────────────────────────────────
function updateAdcProject(projectId) {
  const adc = readAdcFile();
  if (!adc) throw new Error('ADC 파일이 없습니다. 먼저 Google 계정을 연결해 주세요.');
  writeAdcFile(adc.refresh_token, projectId);
}

// ── PKCE code_challenge 생성 ──────────────────────────────────────────────
function makeCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest().toString('base64url');
}

// ── 브라우저 성공/실패 HTML ───────────────────────────────────────────────
function getLogoDataUrl() {
  const candidates = [
    path.join(__dirname, '../../../assets/BanaNyang-icon.png'),
    path.join(__dirname, '../../../assets/bananyang-icon.png'),
    path.join(__dirname, '../../assets/bananyang-icon.png'),
    path.join(process.resourcesPath || '', 'app', 'assets', 'BanaNyang-icon.png'),
    path.join(process.resourcesPath || '', 'app', 'assets', 'bananyang-icon.png'),
  ];
  for (const p of candidates) {
    try {
      return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
    } catch (_) {}
  }
  return null;
}

function buildSuccessHtml(email, subtitle) {
  const logoDataUrl = getLogoDataUrl();
  const iconHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="BanaNyang" class="logo">`
    : `<div class="icon">🍌</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>BanaNyang — 연결 완료</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0d0d0d;color:#fff;font-family:-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{text-align:center;padding:48px 40px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;max-width:380px}.logo{width:72px;height:72px;object-fit:contain;margin-bottom:20px}.icon{font-size:48px;margin-bottom:20px}.title{color:#F5C518;font-size:22px;font-weight:700;margin-bottom:10px}.sub{color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:4px}.hint{color:#52525b;font-size:12px;margin-top:20px}</style>
</head><body><div class="card">
${iconHtml}
<div class="title">연결 완료!</div>
<div class="sub"><strong style="color:#e4e4e7">${email}</strong></div>
<div class="sub">${subtitle}</div>
<div class="hint">이 창을 닫고 BanaNyang으로 돌아가세요</div>
</div><script>setTimeout(()=>window.close(),3000)</script></body></html>`;
}

function errorHtml(msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>BanaNyang — 인증 실패</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0d0d0d;color:#fff;font-family:-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{text-align:center;padding:48px 40px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;max-width:380px}.icon{font-size:48px;margin-bottom:20px}.title{color:#ef4444;font-size:22px;font-weight:700;margin-bottom:10px}.sub{color:#a1a1aa;font-size:14px;line-height:1.6}.hint{color:#52525b;font-size:12px;margin-top:20px}</style>
</head><body><div class="card">
<div class="icon">⚠️</div>
<div class="title">인증 실패</div>
<div class="sub">${msg}</div>
<div class="hint">창을 닫고 다시 시도해 주세요</div>
</div></body></html>`;
}

// ── 공통 OAuth2 loopback 플로우 헬퍼 ─────────────────────────────────────
// successSubtitle: 성공 HTML 두 번째 줄 텍스트
// onTokens: async ({ tokens, email }) => extraFields — 토큰 처리 콜백, 추가 필드 반환
async function _runOAuth2Flow({ successSubtitle, onTokens }) {
  const { shell } = require('electron');

  return new Promise((resolve) => {
    const server = http.createServer();

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      const oauth2 = new OAuth2Client(GCLOUD_CLIENT_ID, GCLOUD_CLIENT_SECRET, redirectUri);

      const verifier = crypto.randomBytes(32).toString('hex');
      const challenge = makeCodeChallenge(verifier);

      const authUrl = oauth2.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        code_challenge_method: 'S256',
        code_challenge: challenge,
      });

      let done = false;
      let timer;

      const finish = (result) => {
        if (done) return;
        done = true;
        _currentFinishVertex = null;
        clearTimeout(timer);
        if (server.listening) server.close();
        resolve(result);
      };

      _currentFinishVertex = finish;

      server.on('request', async (req, res) => {
        try {
          const url = new URL(req.url, `http://127.0.0.1:${port}`);
          if (url.pathname !== '/callback') {
            res.writeHead(404);
            res.end();
            return;
          }

          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error || !code) {
            const msg = error || 'Authorization code not received';
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(errorHtml(msg));
            finish({ success: false, error: msg });
            return;
          }

          const { tokens } = await oauth2.getToken({ code, codeVerifier: verifier });
          if (!tokens.refresh_token) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(errorHtml('Refresh token을 받지 못했습니다. 다시 시도해 주세요.'));
            finish({ success: false, error: 'No refresh token received' });
            return;
          }

          let email = '';
          try {
            oauth2.setCredentials(tokens);
            const infoRes = await oauth2.request({
              url: 'https://www.googleapis.com/oauth2/v2/userinfo',
            });
            email = infoRes.data.email || '';
          } catch (e) {
            console.warn('[GoogleAuth] userinfo 조회 실패:', e.message);
          }

          const extra = await onTokens({ tokens, email });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildSuccessHtml(email || 'Google 계정', successSubtitle));
          finish({ success: true, email, accessToken: tokens.access_token || null, ...extra });
        } catch (err) {
          console.error('[GoogleAuth] 콜백 처리 오류:', err);
          try {
            res.writeHead(500);
            res.end(errorHtml(err.message));
          } catch (_) {}
          finish({ success: false, error: err.message });
        }
      });

      timer = setTimeout(() => {
        finish({ success: false, error: '인증 시간 초과 (5분). 다시 시도해 주세요.' });
      }, 300000);

      server.on('error', (err) => {
        finish({ success: false, error: `서버 오류: ${err.message}` });
      });

      shell.openExternal(authUrl);
    });

    server.on('error', (err) => {
      resolve({ success: false, error: `서버 시작 실패: ${err.message}` });
    });
  });
}

// ── Vertex AI OAuth2 인증 플로우 — ADC 파일 저장 ─────────────────────────
async function startOAuth2Flow({ projectId }) {
  return _runOAuth2Flow({
    successSubtitle: 'Vertex AI에 연결되었습니다',
    onTokens: async ({ tokens }) => {
      writeAdcFile(tokens.refresh_token, projectId);
      return { projectId };
    },
  });
}

// ── 진행 중인 OAuth 플로우 취소 ──────────────────────────────────────────
function cancelOAuth2Flow() {
  if (_currentFinishVertex) {
    _currentFinishVertex({ success: false, error: 'user_cancelled' });
  }
}

// ── Access Token 갱신 (ADC 파일 사용 — Vertex AI) ────────────────────────
async function refreshAccessToken() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('ADC 토큰 갱신 실패: 토큰이 없습니다.');
  return token;
}

// ── 프로젝트 목록 조회 (Cloud Resource Manager API) ───────────────────────
async function listProjects(accessToken) {
  const token = accessToken || await refreshAccessToken();
  const https = require('https');

  return new Promise((resolve, reject) => {
    const url = 'https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE&pageSize=100';
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`프로젝트 목록 조회 실패 (${res.statusCode}): ${data}`));
          return;
        }
        try {
          const body = JSON.parse(data);
          const projects = (body.projects || []).map((p) => ({
            projectId: p.projectId,
            name: p.name,
          }));
          resolve(projects);
        } catch (e) {
          reject(new Error(`프로젝트 목록 파싱 실패: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
  });
}

module.exports = {
  startOAuth2Flow,
  cancelOAuth2Flow,
  refreshAccessToken,
  listProjects,
  checkAdcStatus,
  readAdcFile,
  writeAdcFile,
  deleteAdcFile,
  updateAdcProject,
  ADC_PATH,
};
