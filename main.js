'use strict';
/*
 * KAMANJAMIX VIDEO STUDIO - Electron shell.
 * This file only hosts the existing web app (app/kamanjamix-video-studio-standalone.html)
 * in a desktop window. It does not change any feature of the app itself.
 */
const { app, BrowserWindow, Menu, session, dialog, ipcMain } = require('electron');
const { pathToFileURL, fileURLToPath } = require('url');
const path = require('path');
const fs = require('fs');

const APP_TITLE = 'KAMANJAMIX VIDEO STUDIO';
const ENTRY = path.join(__dirname, 'app', 'kamanjamix-video-studio-standalone.html');
const ICON = path.join(__dirname, 'build', 'icon.ico');

/* Optional self-test used by BUILD.bat / GitHub Actions:  app.exe --smoke-test="C:\path\result.json" */
const smokeArg = process.argv.find(a => a.startsWith('--smoke-test'));
const SMOKE = !!smokeArg;
const SMOKE_OUT = smokeArg && smokeArg.includes('=')
  ? smokeArg.split('=').slice(1).join('=').replace(/^"+|"+$/g, '')
  : path.join(app.getPath('temp'), 'kamanjamix-smoke-test.json');

/* The app plays audio from a button click, but recording/export must never be blocked by the policy. */
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
/* Lets the optional face auto-detect button work if Windows provides a detector (manual points always work). */
app.commandLine.appendSwitch('enable-blink-features', 'ShapeDetection');
/* Safety net: software WebGL on PCs without a usable GPU, so the singer warp (WebGL) still renders. */
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

app.setAppUserModelId('com.kamanjamix.videostudio');

let mainWindow = null;

/* Stream long recordings to disk: serialize writes and wait for the stream to finish
   before exposing the completed file. This avoids timer-based truncation on 8 GB PCs. */
let recStream = null, recPath = null, recStreamError = null;
function waitForStreamOpen(stream) {
  return new Promise((resolve, reject) => {
    const onOpen = () => { cleanup(); resolve(); };
    const onError = err => { cleanup(); reject(err); };
    const cleanup = () => { stream.off('open', onOpen); stream.off('error', onError); };
    stream.once('open', onOpen);
    stream.once('error', onError);
  });
}
ipcMain.handle('rec:begin', async () => {
  if (recStream) throw new Error('A recording is already being written.');
  recPath = path.join(app.getPath('temp'), 'kamanjamix-rec-' + Date.now() + '.bin');
  recStreamError = null;
  const stream = fs.createWriteStream(recPath, { flags: 'wx' });
  recStream = stream;
  stream.on('error', err => { recStreamError = err; });
  try {
    await waitForStreamOpen(stream);
    return true;
  } catch (err) {
    recStream = null;
    throw err;
  }
});
ipcMain.handle('rec:write', async (e, u8) => {
  const stream = recStream;
  if (!stream || stream.destroyed || stream.writableEnded) throw new Error('Recording stream is not available.');
  if (recStreamError) throw recStreamError;
  if (!(u8 instanceof Uint8Array) && !ArrayBuffer.isView(u8) && !(u8 instanceof ArrayBuffer)) {
    throw new TypeError('Recording chunk must be binary data.');
  }
  const data = Buffer.from(u8 instanceof ArrayBuffer ? new Uint8Array(u8) : u8);
  await new Promise((resolve, reject) => {
    stream.write(data, err => err ? reject(err) : resolve());
  });
  if (recStreamError) throw recStreamError;
  return true;
});
ipcMain.handle('rec:end', async () => {
  const stream = recStream;
  const filePath = recPath;
  if (!stream) return '';
  recStream = null;
  if (recStreamError || stream.destroyed) {
    const err = recStreamError || new Error('Recording stream closed before finalization.');
    try { stream.destroy(); } catch (ignore) {}
    throw err;
  }
  await new Promise((resolve, reject) => {
    const onError = err => { cleanup(); reject(err); };
    const onFinish = () => { cleanup(); resolve(); };
    const cleanup = () => { stream.off('error', onError); stream.off('finish', onFinish); };
    stream.once('error', onError);
    stream.once('finish', onFinish);
    stream.end();
  });
  if (recStreamError) throw recStreamError;
  return pathToFileURL(filePath).href;
});


if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
}

function hardenSession() {
  const ses = session.defaultSession;
  /* The app is fully offline: block every network request. */
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'] },
    (details, cb) => cb({ cancel: true })
  );
  /* No camera / microphone / location etc. Fullscreen is kept for the preview video player. */
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'fullscreen'));
  ses.setPermissionCheckHandler((wc, permission) => permission === 'fullscreen');
  /* Saving a recorded clip: show the normal Windows "Save as" dialog, default to the Videos folder. */
  ses.on('will-download', (event, item) => {
    const name = item.getFilename() || 'kamanjamix-clip.webm';
    try {
      item.setSaveDialogOptions({
        title: APP_TITLE,
        defaultPath: path.join(app.getPath('videos'), name),
        filters: /\.mp4$/i.test(name) ? [{ name: 'MP4 Video', extensions: ['mp4'] }, { name: 'All files', extensions: ['*'] }] : [{ name: 'WebM Video', extensions: ['webm'] }, { name: 'All files', extensions: ['*'] }]
      });
    } catch (e) { /* fall back to Electron's default save dialog */ }
  });
}

function start() {
  if (!fs.existsSync(ENTRY)) {
    dialog.showErrorBox(APP_TITLE, 'Application file is missing:\n' + ENTRY);
    app.exit(1);
    return;
  }
  Menu.setApplicationMenu(null);
  hardenSession();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: APP_TITLE,
    icon: fs.existsSync(ICON) ? ICON : undefined,
    backgroundColor: '#0a0712',
    show: SMOKE,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false,
      /* keep rendering/recording running even if the window is covered or minimized */
      backgroundThrottling: false
    }
  });

  const wc = mainWindow.webContents;
  mainWindow.on('page-title-updated', e => e.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e, url) => {
    if (!(url.startsWith('file://') || url.startsWith('blob:'))) e.preventDefault();
  });
  wc.on('render-process-gone', (e, details) => {
    if (SMOKE) return;
    dialog.showErrorBox(APP_TITLE, 'The window stopped unexpectedly (' + details.reason + '). Please restart the app.');
  });

  if (SMOKE) runSmokeTest(wc);
  mainWindow.loadFile(ENTRY);
}

/* ---------- self-test (does not run in normal use) ---------- */
function runSmokeTest(wc) {
  const result = {
    ok: false,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    packaged: app.isPackaged,
    entryExists: fs.existsSync(ENTRY),
    consoleErrors: [],
    checks: {},
    info: {}
  };
  const finish = code => {
    try { fs.mkdirSync(path.dirname(SMOKE_OUT), { recursive: true }); fs.writeFileSync(SMOKE_OUT, JSON.stringify(result, null, 2)); } catch (e) { /* ignore */ }
    app.exit(code);
  };
  const guard = setTimeout(() => { result.consoleErrors.push('timeout: self-test took more than 60 s'); finish(2); }, 60000);

  wc.on('console-message', (...args) => {
    const ev = args[0] && typeof args[0] === 'object' && 'message' in args[0] ? args[0] : null;
    const level = ev ? ev.level : args[1];
    const message = ev ? ev.message : args[2];
    if (level === 3 || level === 'error') result.consoleErrors.push(String(message));
  });
  wc.on('did-fail-load', (e, code, desc) => { result.consoleErrors.push('did-fail-load ' + code + ' ' + desc); });

  wc.once('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 2500));
      const probe = await wc.executeJavaScript(`(async () => {
        const t0 = T; await new Promise(r => setTimeout(r, 1200));
        const o = {
          frameLoopRunning: T > t0,
          perfTickDefined: typeof perfTick === 'function',
          stageCanvas: !!document.querySelector('#stage') && cv.width > 0,
          uiControls: document.querySelectorAll('input,button,select').length,
          audioContextAvailable: typeof (window.AudioContext || window.webkitAudioContext) === 'function',
          recordingApi: typeof MediaRecorder === 'function' && typeof cv.captureStream === 'function'
        };
        const info = { webgl: typeof GLok !== 'undefined' ? GLok : null, faceDetector: 'FaceDetector' in window };
        try {
          document.querySelector('#demo').click();
          await new Promise(r => setTimeout(r, 1500));
          info.demoPlays = !!isPlaying();
          info.audioState = AC ? AC.state : 'none';
          info.audioBassSeen = S.bass > 0 || S.beats > 0;
          info.lipSyncOn = S.lipSync === true && typeof M.vw === 'number';
          info.mouthOpenSeen = M.open > 0 || S.voice > 0;
          document.querySelector('#rec').click();
          await new Promise(r => setTimeout(r, 3000));
          document.querySelector('#rec').click();
          const deadline = Date.now() + 20000;
          while (document.querySelector('#dl').style.display === 'none' && Date.now() < deadline) await new Promise(r => setTimeout(r, 250));
          info.exportLink = document.querySelector('#dl').href;
          info.exportOk = document.querySelector('#dl').style.display !== 'none' && document.querySelector('#dl').href.length > 10;
          document.querySelector('#demo').click();
        } catch (e) { info.demoError = String(e); }
        return { o, info };
      })()`, true);
      result.checks = probe.o;
      result.info = probe.info;
      if (probe.info.exportLink && probe.info.exportLink.startsWith('file://')) {
        try {
          const exportedPath = fileURLToPath(probe.info.exportLink);
          const stat = fs.statSync(exportedPath);
          result.info.exportFileBytes = stat.size;
          result.info.exportFileExists = stat.isFile() && stat.size > 0;
        } catch (err) { result.info.exportFileError = String(err); }
      }
      const c = probe.o;
      result.ok = result.entryExists && c.frameLoopRunning && c.perfTickDefined && c.stageCanvas &&
        c.uiControls >= 40 && c.audioContextAvailable && c.recordingApi && probe.info.lipSyncOn && probe.info.exportOk && probe.info.exportFileExists === true && result.consoleErrors.length === 0;
    } catch (e) {
      result.consoleErrors.push('self-test exception: ' + e);
    }
    clearTimeout(guard);
    finish(result.ok ? 0 : 1);
  });
}
