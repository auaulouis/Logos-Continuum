/* eslint-disable jsx-a11y/anchor-is-valid */
import mixpanel from 'mixpanel-browser';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ConnectDropboxButton from '../components/dropbox/ConnectDropboxButton';
import { AppContext } from '../lib/appContext';
import * as apiService from '../services/api';
import styles from '../styles/index.module.scss';

type DebugLevel = 'info' | 'warn' | 'error';
type DebugEntry = {
  id: number;
  at: number;
  level: DebugLevel;
  message: string;
};

const IndexPage = () => {
  type DebugPhase = 'closed' | 'open' | 'closing';
  const [query, setQuery] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadDetails, setUploadDetails] = useState('');
  const [debugPhase, setDebugPhase] = useState<DebugPhase>('closed');
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([
    { id: 1, at: Date.now(), level: 'info', message: 'Debug console initialized' },
  ]);
  const { theme } = useContext(AppContext);
  const backgroundCanvasElement = useRef<HTMLCanvasElement | null>(null);
  const uploadInputElement = useRef<HTMLInputElement | null>(null);
  const uploadDetailsElement = useRef<HTMLTextAreaElement | null>(null);
  const debugLogElement = useRef<HTMLDivElement | null>(null);
  const debugCloseTimer = useRef<number | null>(null);
  const router = useRouter();

  const isDebugOpen = debugPhase === 'open';
  const isDebugRendered = debugPhase !== 'closed';

  const closeDebugConsole = useCallback(() => {
    if (debugPhase === 'closing' || debugPhase === 'closed') {
      return;
    }
    setDebugPhase('closing');
    if (debugCloseTimer.current !== null) {
      window.clearTimeout(debugCloseTimer.current);
    }
    debugCloseTimer.current = window.setTimeout(() => {
      setDebugPhase('closed');
      debugCloseTimer.current = null;
    }, 220);
  }, [debugPhase]);

  const openDebugConsole = useCallback(() => {
    if (debugCloseTimer.current !== null) {
      window.clearTimeout(debugCloseTimer.current);
      debugCloseTimer.current = null;
    }
    setDebugPhase('open');
  }, []);

  const toggleDebugConsole = useCallback(() => {
    if (debugPhase === 'open') {
      closeDebugConsole();
    } else {
      openDebugConsole();
    }
  }, [debugPhase, closeDebugConsole, openDebugConsole]);

  const addDebugEntry = useCallback((level: DebugLevel, message: string) => {
    setDebugEntries((prev) => {
      const next: DebugEntry[] = [...prev, {
        id: Date.now() + Math.floor(Math.random() * 1000),
        at: Date.now(),
        level,
        message,
      }];
      return next.slice(-140);
    });
  }, []);

  const formattedDebugEntries = useMemo(() => debugEntries.map((entry) => {
    const timestamp = new Date(entry.at).toLocaleTimeString();
    return {
      ...entry,
      line: `[${timestamp}] ${entry.level.toUpperCase()} ${entry.message}`,
    };
  }), [debugEntries]);

  useEffect(() => {
   // mixpanel.track('Page View', {
     // page: 'Home',
   // });
    addDebugEntry('info', 'Home page mounted');
  }, []);

  useEffect(() => {
    document.body.style.fontFamily = 'Helvetica, Arial, sans-serif';
  }, []);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const message = event.message || 'Unknown window error';
      addDebugEntry('error', message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      addDebugEntry('error', `Unhandled promise rejection: ${reason}`);
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [addDebugEntry]);

  useEffect(() => {
    if (uploadDetailsElement.current) {
      uploadDetailsElement.current.scrollTop = uploadDetailsElement.current.scrollHeight;
    }
  }, [uploadDetails]);

  useEffect(() => {
    if (debugLogElement.current) {
      debugLogElement.current.scrollTop = debugLogElement.current.scrollHeight;
    }
  }, [formattedDebugEntries, isDebugOpen]);

  useEffect(() => () => {
    if (debugCloseTimer.current !== null) {
      window.clearTimeout(debugCloseTimer.current);
    }
  }, []);

  useEffect(() => {
    const canvasElement = backgroundCanvasElement.current;
    if (!canvasElement) {
      addDebugEntry('warn', 'Background canvas ref missing');
      return;
    }

    const context = canvasElement.getContext('2d');
    if (!context) {
      addDebugEntry('error', 'Failed to acquire 2D context');
      return;
    }

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pointerTarget = { ...pointer };
    const pointerVelocity = { x: 0, y: 0 };
    const flow = { x: 0, y: 0 };
    const lastPointer = { ...pointer };
    const trailPoints: Array<{ x: number; y: number; life: number; strength: number }> = [];
    const devicePixelRatio = window.devicePixelRatio || 1;
    const cellSize = 24;
    const fieldCanvas = document.createElement('canvas');
    const fieldContext = fieldCanvas.getContext('2d');
    if (!fieldContext) {
      addDebugEntry('error', 'Failed to create offscreen field context');
      return;
    }

    const backgroundPalette = theme === 'dark'
      ? {
        baseFill: '#04050b',
        baseTemperature: 0.2,
        hueBase: 258,
        hueSpan: 34,
        hueHaloShift: 8,
        hueWaveAmp: 14,
        hueMin: 228,
        hueMax: 286,
        saturationBase: 54,
        saturationSpan: 12,
        lightnessBase: 18,
        lightnessSpan: 9,
        alpha: 0.94,
        coreHeatRadius: 150,
        haloHeatRadius: 340,
        coreHeatWeight: 0.2,
        haloHeatWeight: 0.12,
        orbHueA: 224,
        orbHueB: 266,
        orbHueC: 244,
        orbSat: 68,
        orbLightA: 42,
        orbLightB: 50,
        orbLightC: 58,
        trailLightA: 46,
        trailLightB: 60,
      }
      : {
        baseFill: '#f8f8ff',
        baseTemperature: 0.32,
        hueBase: 236,
        hueSpan: 74,
        hueHaloShift: 14,
        hueWaveAmp: 6,
        hueMin: 188,
        hueMax: 286,
        saturationBase: 56,
        saturationSpan: 6,
        lightnessBase: 96,
        lightnessSpan: 14,
        alpha: 0.9,
        coreHeatRadius: 105,
        haloHeatRadius: 200,
        coreHeatWeight: 0.52,
        haloHeatWeight: 0.24,
        orbHueA: 184,
        orbHueB: 214,
        orbHueC: 196,
        orbSat: 42,
        orbLightA: 66,
        orbLightB: 72,
        orbLightC: 78,
        trailLightA: 64,
        trailLightB: 78,
      };

    let fieldWidth = 0;
    let fieldHeight = 0;

    const anchors = [
      { x: 0.16, y: 0.24, weight: 0.22, radius: 340 },
      { x: 0.82, y: 0.18, weight: 0.2, radius: 320 },
      { x: 0.26, y: 0.78, weight: 0.26, radius: 360 },
      { x: 0.78, y: 0.72, weight: 0.24, radius: 330 },
    ];

    let frameId = 0;

    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvasElement.width = Math.floor(width * devicePixelRatio);
      canvasElement.height = Math.floor(height * devicePixelRatio);
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      fieldWidth = Math.max(1, Math.ceil(width / cellSize));
      fieldHeight = Math.max(1, Math.ceil(height / cellSize));
      fieldCanvas.width = fieldWidth;
      fieldCanvas.height = fieldHeight;

    };

    const onPointerMove = (event: PointerEvent) => {
      pointerTarget.x = event.clientX;
      pointerTarget.y = event.clientY;

      const rawDx = event.clientX - lastPointer.x;
      const rawDy = event.clientY - lastPointer.y;
      const rawSpeed = Math.hypot(rawDx, rawDy);
      const maxStep = 36;
      const velocityScale = rawSpeed > maxStep ? maxStep / rawSpeed : 1;
      const clampedDx = rawDx * velocityScale;
      const clampedDy = rawDy * velocityScale;

      pointerVelocity.x = pointerVelocity.x * 0.55 + clampedDx * 0.45;
      pointerVelocity.y = pointerVelocity.y * 0.55 + clampedDy * 0.45;

      if (rawSpeed > 1.4) {
        trailPoints.push({
          x: event.clientX,
          y: event.clientY,
          life: 1,
          strength: Math.min(1, rawSpeed / 22),
        });
        if (trailPoints.length > 12) {
          trailPoints.shift();
        }
      }

      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
    };

    const onPointerLeave = () => {
      pointerTarget.x = window.innerWidth / 2;
      pointerTarget.y = window.innerHeight / 2;
    };

    const drawFrame = (time: number) => {
      try {
        const width = window.innerWidth;
        const height = window.innerHeight;

      pointer.x += (pointerTarget.x - pointer.x) * 0.16;
      pointer.y += (pointerTarget.y - pointer.y) * 0.16;
      flow.x += (pointerVelocity.x - flow.x) * 0.085;
      flow.y += (pointerVelocity.y - flow.y) * 0.085;
      pointerVelocity.x *= 0.9;
      pointerVelocity.y *= 0.9;

      const flowMagnitudeRaw = Math.hypot(flow.x, flow.y);
      const maxFlow = 13;
      if (flowMagnitudeRaw > maxFlow) {
        const reduction = maxFlow / flowMagnitudeRaw;
        flow.x *= reduction;
        flow.y *= reduction;
      }
      const flowMagnitude = Math.hypot(flow.x, flow.y);
      const flowDirX = flowMagnitude > 0.001 ? flow.x / flowMagnitude : 0;
      const flowDirY = flowMagnitude > 0.001 ? flow.y / flowMagnitude : 0;

      for (let pointIndex = trailPoints.length - 1; pointIndex >= 0; pointIndex -= 1) {
        trailPoints[pointIndex].life -= 0.042;
        if (trailPoints[pointIndex].life <= 0) {
          trailPoints.splice(pointIndex, 1);
        }
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = backgroundPalette.baseFill;
      context.fillRect(0, 0, width, height);

      for (let gridY = 0; gridY < fieldHeight; gridY += 1) {
        for (let gridX = 0; gridX < fieldWidth; gridX += 1) {
          const gx = gridX * cellSize;
          const gy = gridY * cellSize;
          const cursorDx = gx - pointer.x;
          const cursorDy = gy - pointer.y;
          const cursorDist2 = cursorDx * cursorDx + cursorDy * cursorDy;
          const dragInfluence = Math.exp(-cursorDist2 / (2 * 210 * 210));

          const advectX = gx - flow.x * (6.4 * dragInfluence);
          const advectY = gy - flow.y * (6.4 * dragInfluence);
          const nx = advectX / width;
          const ny = advectY / height;

          let temperature = backgroundPalette.baseTemperature;
          temperature += 0.09 * Math.sin(nx * 8.4 + time * 0.00045);
          temperature += 0.08 * Math.cos(ny * 7.8 + time * 0.0004);
          temperature += 0.06 * Math.sin((nx + ny) * 9.2 + time * 0.0005);

          const coreHeat = Math.exp(-cursorDist2 / (2 * backgroundPalette.coreHeatRadius * backgroundPalette.coreHeatRadius));
          const haloHeat = Math.exp(-cursorDist2 / (2 * backgroundPalette.haloHeatRadius * backgroundPalette.haloHeatRadius));
          temperature += backgroundPalette.coreHeatWeight * coreHeat;
          temperature += backgroundPalette.haloHeatWeight * haloHeat;

          const wakeX = pointer.x - flow.x * 16;
          const wakeY = pointer.y - flow.y * 16;
          const wakeDx = gx - wakeX;
          const wakeDy = gy - wakeY;
          const wakeDist2 = wakeDx * wakeDx + wakeDy * wakeDy;
          temperature += (0.24 + Math.min(0.24, flowMagnitude * 0.018)) * Math.exp(-wakeDist2 / (2 * 300 * 300));

          let trailHeat = 0;
          for (let pointIndex = 0; pointIndex < trailPoints.length; pointIndex += 1) {
            const point = trailPoints[pointIndex];
            const trailDx = gx - point.x;
            const trailDy = gy - point.y;
            const trailDist2 = trailDx * trailDx + trailDy * trailDy;
            const trailRadius = 42 + point.strength * 34;
            const directionalDot = trailDx * flowDirX + trailDy * flowDirY;
            const rearBias = Math.max(0, Math.min(1, (-directionalDot / (trailRadius * 0.8)) + 0.08));
            trailHeat += point.life * point.strength * rearBias * Math.exp(-trailDist2 / (2 * trailRadius * trailRadius));
          }
          temperature += 0.22 * trailHeat;

          for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex += 1) {
            const anchor = anchors[anchorIndex];
            const phase = time * (0.00018 + anchorIndex * 0.00003);
            const anchorX = anchor.x * width + Math.sin(phase + anchorIndex) * (flow.x * 4.5);
            const anchorY = anchor.y * height + Math.cos(phase + anchorIndex) * (flow.y * 4.5);
            const dx = advectX - anchorX;
            const dy = advectY - anchorY;
            const dist2 = dx * dx + dy * dy;
            temperature += anchor.weight * Math.exp(-dist2 / (2 * anchor.radius * anchor.radius));
          }

          const clamped = Math.max(0, Math.min(1, temperature));
          const hueWave =
            Math.sin(nx * 14 + time * 0.00023) * backgroundPalette.hueWaveAmp
            + Math.cos(ny * 11 - time * 0.00019) * (backgroundPalette.hueWaveAmp * 0.55);
          const rawHue = backgroundPalette.hueBase - clamped * backgroundPalette.hueSpan - haloHeat * backgroundPalette.hueHaloShift + hueWave;
          const hue = Math.max(backgroundPalette.hueMin, Math.min(backgroundPalette.hueMax, rawHue));
          const saturation = Math.max(
            16,
            backgroundPalette.saturationBase
              - clamped * backgroundPalette.saturationSpan
              + Math.sin((nx - ny) * 7 + time * 0.0002) * 6,
          );
          const lightness = Math.max(
            12,
            backgroundPalette.lightnessBase
              - clamped * backgroundPalette.lightnessSpan
              + Math.cos((nx + ny) * 5 - time * 0.00017) * 3,
          );
          const alpha = backgroundPalette.alpha;

          fieldContext.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
          fieldContext.fillRect(gridX, gridY, 1, 1);
        }
      }

      context.save();
      context.imageSmoothingEnabled = true;
      context.globalAlpha = 0.92;
      context.drawImage(fieldCanvas, 0, 0, fieldWidth, fieldHeight, 0, 0, width, height);
      context.restore();

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addDebugEntry('error', `Background frame: ${message}`);
        console.error('Temperature map frame error', error);
      }

      frameId = window.requestAnimationFrame(drawFrame);
    };

    resizeCanvas();
    addDebugEntry('info', 'Background renderer started');
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    frameId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      addDebugEntry('info', 'Background renderer stopped');
    };
  }, [addDebugEntry, theme]);

  const search = () => {
    if (query.trim().length > 0) {
      addDebugEntry('info', `Search submitted: "${query.trim()}"`);
      router.push(`/query?search=${encodeURI(query)}`);
    } else {
      addDebugEntry('warn', 'Search ignored: empty query');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  const onDocxUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      addDebugEntry('warn', 'Upload ignored: no files selected');
      return;
    }

    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.docx'));
    const invalidFiles = selectedFiles.filter((file) => !file.name.toLowerCase().endsWith('.docx'));

    setUploadStatus('Parsing uploaded file(s)...');
    addDebugEntry('info', `Upload started: ${selectedFiles.length} file(s)`);
    if (validFiles.length > 0) {
      setUploadDetails(`Parsing now:\n${validFiles.map((file) => `- ${file.name}`).join('\n')}`);
    } else {
      setUploadDetails('No valid .docx files selected.');
      setUploadStatus('Parsed 0 file(s).');
      addDebugEntry('warn', 'Upload skipped: no valid .docx files');
      return;
    }

    const outcomes = await Promise.all(validFiles.map(async (file) => {
      try {
        const response = await apiService.uploadDocx(file);
        return { filename: file.name, ok: !!response.ok };
      } catch (error) {
        return { filename: file.name, ok: false };
      }
    }));

    const parsedNames = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.filename);
    const failedNames = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.filename);
    const invalidNames = invalidFiles.map((file) => file.name);

    const succeeded = parsedNames.length;
    const failed = failedNames.length + invalidNames.length;
    addDebugEntry('info', `Upload finished: success=${succeeded}, failed=${failed}`);

    setUploadStatus(`Parsed ${succeeded} file(s). ${failed > 0 ? `${failed} failed.` : ''}`.trim());
    setUploadDetails([
      parsedNames.length > 0 ? `Parsed:\n${parsedNames.map((name) => `- ${name}`).join('\n')}` : '',
      failedNames.length > 0 ? `Failed parsing:\n${failedNames.map((name) => `- ${name}`).join('\n')}` : '',
      invalidNames.length > 0 ? `Skipped (not .docx):\n${invalidNames.map((name) => `- ${name}`).join('\n')}` : '',
    ].filter((block) => block.length > 0).join('\n\n'));
  };

  const onCopyDebugLogs = useCallback(async () => {
    const payload = formattedDebugEntries.map((entry) => entry.line).join('\n');
    if (!payload) {
      addDebugEntry('warn', 'Copy logs skipped: no logs to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      addDebugEntry('info', `Copied ${formattedDebugEntries.length} log lines to clipboard`);
    } catch (error) {
      addDebugEntry('error', 'Failed to copy logs to clipboard');
    }
  }, [formattedDebugEntries, addDebugEntry]);

  return (
    <>
      <Head>
        <title>Logos Continuum: A Debate Search Engine</title>
        <meta name="description" content="Search debate cards with Logos Continuum" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.container}>
        <canvas ref={backgroundCanvasElement} className={styles['temperature-map']} aria-hidden="true" />
        <div className={styles['corner-controls']}>
          <Link href="/settings" passHref>
            <a className={styles['panel-settings-link']}>
              <img
                src="/settings_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png"
                alt="Settings"
                className={styles['panel-settings-icon']}
              />
              Settings
            </a>
          </Link>
          <button
            type="button"
            className={styles['bug-report-button']}
            aria-label="Toggle debug console"
            onClick={toggleDebugConsole}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              aria-hidden="true"
              className={styles['bug-report-icon']}
            >
              <path d="M480-200q66 0 113-47t47-113v-160q0-66-47-113t-113-47q-66 0-113 47t-47 113v160q0 66 47 113t113 47Zm-80-120h160v-80H400v80Zm0-160h160v-80H400v80Zm80 40Zm0 320q-65 0-120.5-32T272-240H160v-80h84q-3-20-3.5-40t-.5-40h-80v-80h80q0-20 .5-40t3.5-40h-84v-80h112q14-23 31.5-43t40.5-35l-64-66 56-56 86 86q28-9 57-9t57 9l88-86 56 56-66 66q23 15 41.5 34.5T688-640h112v80h-84q3 20 3.5 40t.5 40h80v80h-80q0 20-.5 40t-3.5 40h84v80H688q-32 56-87.5 88T480-120Z" />
            </svg>
          </button>
        </div>
        {isDebugRendered && (
          <div
            className={`${styles['debug-console']} ${debugPhase === 'closing' ? styles['debug-console-closing'] : ''}`}
            role="dialog"
            aria-label="Debug console"
          >
            <div className={styles['debug-console-header']}>
              <span>logs@logos-continuum:~$</span>
              <div className={styles['debug-console-actions']}>
                <button
                  type="button"
                  className={styles['debug-console-btn']}
                  onClick={onCopyDebugLogs}
                >
                  copy logs
                </button>
                <button
                  type="button"
                  className={styles['debug-console-btn']}
                  onClick={() => setDebugEntries([])}
                >
                  clear
                </button>
                <button
                  type="button"
                  className={styles['debug-console-btn']}
                  onClick={closeDebugConsole}
                >
                  close
                </button>
              </div>
            </div>
            <div ref={debugLogElement} className={styles['debug-console-body']}>
              {formattedDebugEntries.length === 0 && (
                <div className={styles['debug-line-muted']}>[empty] no events yet</div>
              )}
              {formattedDebugEntries.map((entry) => (
                <div key={entry.id} className={`${styles['debug-line']} ${styles[`debug-line-${entry.level}`]}`}>
                  {entry.line}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={styles.foreground}>
        <div className={styles.panel}>
        {/* <ConnectDropboxButton /> */}

        <h1 className={styles.logo}>LOGOS CONTINUUM</h1>
        {/* <h2 className={styles.subtitle}>The platform has been disabled for the moment for maintenance and upgrades. We hope to be back soon!</h2> */}
        <h2 className={styles.subtitle}>a debate search platform</h2>

        <div className={styles.row}>
          <input onKeyDown={onKeyDown} className={styles.search} placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className={styles.submit} onClick={search}>Search</button>
        </div>

        <div className={styles.upload}>
          <p className={styles['upload-label']}>Upload DOCX to parse now</p>
          <div
            className={`${styles['drop-zone']} ${isDraggingFile ? styles['drop-zone-active'] : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => uploadInputElement.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                uploadInputElement.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingFile(false);
              onDocxUpload(event.dataTransfer.files);
            }}
          >
            Drag and drop .docx files here, or click to choose files
          </div>
          <div className={styles['upload-actions']}>
            <div className={styles['upload-input-wrap']}>
              <input
                id="docx-upload-front"
                type="file"
                accept=".docx"
                multiple
                className={styles['upload-input']}
                ref={uploadInputElement}
                onChange={(event) => {
                  onDocxUpload(event.target.files);
                  const inputElement = event.target as HTMLInputElement;
                  inputElement.value = '';
                }}
              />
            </div>
          </div>
          {uploadStatus && <p className={styles['upload-status']}>{uploadStatus}</p>}
          <textarea
            className={styles['upload-details']}
            value={uploadDetails}
            ref={uploadDetailsElement}
            readOnly
            aria-label="Parsing details"
            placeholder="Parsing details will appear here..."
          />
        </div>
        </div>
        </div>
      </div>
    </>
  );
};

export default IndexPage;
