/* eslint-disable jsx-a11y/anchor-is-valid */
import mixpanel from 'mixpanel-browser';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConnectDropboxButton from '../components/dropbox/ConnectDropboxButton';
import * as apiService from '../services/api';
import type { ParsedDocument, ParserSettings } from '../services/api';
import styles from '../styles/index.module.scss';

type DebugLevel = 'info' | 'warn' | 'error';
type DebugEntry = {
  id: number;
  at: number;
  level: DebugLevel;
  message: string;
};

const DEFAULT_PARSER_SETTINGS: ParserSettings = {
  use_parallel_processing: true,
  parser_card_workers: 1,
  local_parser_file_workers: 4,
  flush_enabled: true,
  flush_every_docs: 250,
};

const IndexPage = () => {
  type DebugPhase = 'closed' | 'open' | 'closing';
  const [query, setQuery] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadDetails, setUploadDetails] = useState('');
  const [isClearIndexDialogOpen, setIsClearIndexDialogOpen] = useState(false);
  const [isClearingIndex, setIsClearingIndex] = useState(false);
  const [clearIndexSelected, setClearIndexSelected] = useState(true);
  const [clearFilesSelected, setClearFilesSelected] = useState(false);
  const [isParserSettingsOpen, setIsParserSettingsOpen] = useState(false);
  const [parserSettings, setParserSettings] = useState<ParserSettings>(DEFAULT_PARSER_SETTINGS);
  const [parserSettingsError, setParserSettingsError] = useState('');
  const [isSavingParserSettings, setIsSavingParserSettings] = useState(false);
  const [isDocumentsBoxOpen, setIsDocumentsBoxOpen] = useState(false);
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [documentsError, setDocumentsError] = useState('');
  const [documentsSearch, setDocumentsSearch] = useState('');
  const [showHiddenDocuments, setShowHiddenDocuments] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [deleteInProgressKey, setDeleteInProgressKey] = useState<string | null>(null);
  const [debugPhase, setDebugPhase] = useState<DebugPhase>('closed');
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([
    { id: 1, at: Date.now(), level: 'info', message: 'Debug console initialized' },
  ]);
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
      context.fillStyle = '#f8f8ff';
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

          let temperature = 0.32;
          temperature += 0.09 * Math.sin(nx * 8.4 + time * 0.00045);
          temperature += 0.08 * Math.cos(ny * 7.8 + time * 0.0004);
          temperature += 0.06 * Math.sin((nx + ny) * 9.2 + time * 0.0005);

          const coreHeat = Math.exp(-cursorDist2 / (2 * 105 * 105));
          const haloHeat = Math.exp(-cursorDist2 / (2 * 200 * 200));
          temperature += 0.52 * coreHeat;
          temperature += 0.24 * haloHeat;

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
          const hue = 236 - clamped * 78 - haloHeat * 16;
          const saturation = 58 - clamped * 8;
          const lightness = 96 - clamped * 18;
          const alpha = 0.9;

          fieldContext.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
          fieldContext.fillRect(gridX, gridY, 1, 1);
        }
      }

      context.save();
      context.imageSmoothingEnabled = true;
      context.globalAlpha = 0.96;
      context.drawImage(fieldCanvas, 0, 0, fieldWidth, fieldHeight, 0, 0, width, height);
      context.restore();

      const baseOrbRadius = 26;
      const ambientPulse = 1 + Math.sin(time * 0.00115) * 0.08;
      const orbRadius = baseOrbRadius * ambientPulse;

      const ambientLayerA = context.createRadialGradient(
        pointer.x + Math.sin(time * 0.0012) * 6,
        pointer.y + Math.cos(time * 0.0010) * 5,
        orbRadius * 0.12,
        pointer.x,
        pointer.y,
        orbRadius + 12,
      );
      ambientLayerA.addColorStop(0, 'hsla(154, 68%, 76%, 0.1)');
      ambientLayerA.addColorStop(0.55, 'hsla(154, 66%, 79%, 0.18)');
      ambientLayerA.addColorStop(1, 'hsla(154, 66%, 83%, 0)');
      context.fillStyle = ambientLayerA;
      context.beginPath();
      context.arc(pointer.x, pointer.y, orbRadius + 12, 0, Math.PI * 2);
      context.fill();

      const ambientLayerB = context.createRadialGradient(
        pointer.x - flowDirX * 9 + Math.cos(time * 0.00135) * 4,
        pointer.y - flowDirY * 9 + Math.sin(time * 0.0011) * 4,
        orbRadius * 0.1,
        pointer.x - flowDirX * 2,
        pointer.y - flowDirY * 2,
        orbRadius + 8,
      );
      ambientLayerB.addColorStop(0, 'hsla(154, 64%, 79%, 0.08)');
      ambientLayerB.addColorStop(0.6, 'hsla(154, 62%, 82%, 0.16)');
      ambientLayerB.addColorStop(1, 'hsla(154, 62%, 86%, 0)');
      context.fillStyle = ambientLayerB;
      context.beginPath();
      context.arc(pointer.x - flowDirX * 3, pointer.y - flowDirY * 3, orbRadius + 8, 0, Math.PI * 2);
      context.fill();

      if (flowMagnitude > 0.7) {
        const trailCenterX = pointer.x - flowDirX * (10 + flowMagnitude * 1.2);
        const trailCenterY = pointer.y - flowDirY * (10 + flowMagnitude * 1.2);
        const trailVisualRadius = 26 + flowMagnitude * 1.4;
        const trailGradient = context.createRadialGradient(
          trailCenterX,
          trailCenterY,
          0,
          trailCenterX,
          trailCenterY,
          trailVisualRadius,
        );
        trailGradient.addColorStop(0, 'hsla(154, 62%, 78%, 0.28)');
        trailGradient.addColorStop(1, 'hsla(154, 62%, 86%, 0)');
        context.fillStyle = trailGradient;
        context.save();
        context.translate(trailCenterX, trailCenterY);
        const trailAngle = Math.atan2(flowDirY || 0.0001, flowDirX || 0.0001);
        context.rotate(trailAngle + Math.PI);
        context.scale(1.25, 0.78);
        context.beginPath();
        context.arc(0, 0, trailVisualRadius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

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
  }, [addDebugEntry]);

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

  const onClearIndex = () => {
    setClearIndexSelected(true);
    setClearFilesSelected(false);
    setIsClearIndexDialogOpen(true);
  };

  const onCancelClearIndex = () => {
    if (isClearingIndex) {
      return;
    }
    setIsClearIndexDialogOpen(false);
    setClearIndexSelected(true);
    setClearFilesSelected(false);
    addDebugEntry('info', 'Clear parsed data cancelled by user');
  };

  const onConfirmClearIndex = async () => {
    if (!clearIndexSelected && !clearFilesSelected) {
      return;
    }

    setIsClearingIndex(true);
    try {
      const actionNotes: string[] = [];
      let deletedFiles = 0;
      let failedFileDeletes = 0;

      if (clearIndexSelected) {
        await apiService.clearIndex();
        actionNotes.push('index cleared');
      }

      if (clearFilesSelected) {
        const response = await apiService.getParsedDocuments();
        const docs = Array.isArray(response.documents) ? response.documents : [];
        for (const document of docs) {
          if (!document.in_folder) {
            continue;
          }
          try {
            await apiService.deleteParsedDocument(document.filename, 'folder');
            deletedFiles += 1;
          } catch (error) {
            failedFileDeletes += 1;
          }
        }
        actionNotes.push(`deleted ${deletedFiles} .docx file(s)`);
      }

      setUploadStatus('Clear action completed.');
      setUploadDetails(
        `${actionNotes.join(' + ')}${failedFileDeletes > 0 ? ` (${failedFileDeletes} file deletions failed)` : ''}`,
      );
      addDebugEntry('info', `Clear parsed data completed: ${actionNotes.join(', ')}`);
      setIsClearIndexDialogOpen(false);
      setClearIndexSelected(true);
      setClearFilesSelected(false);
    } catch (error) {
      setUploadStatus('Failed to run clear action.');
      addDebugEntry('error', 'Failed to clear selected parsed data');
    } finally {
      setIsClearingIndex(false);
    }
  };

  const openParserSettings = async () => {
    setIsParserSettingsOpen(true);
    setParserSettingsError('');
    try {
      const response = await apiService.getParserSettings();
      setParserSettings(response.settings);
      addDebugEntry('info', 'Loaded parser settings');
    } catch (error) {
      setParserSettingsError('Failed to load parser settings.');
      addDebugEntry('error', 'Failed to load parser settings');
    }
  };

  const closeParserSettings = () => {
    if (isSavingParserSettings) {
      return;
    }
    setIsParserSettingsOpen(false);
    setParserSettingsError('');
  };

  const onSaveParserSettings = async () => {
    setIsSavingParserSettings(true);
    setParserSettingsError('');
    try {
      const payload: ParserSettings = {
        use_parallel_processing: !!parserSettings.use_parallel_processing,
        parser_card_workers: Math.max(1, Number(parserSettings.parser_card_workers) || 1),
        local_parser_file_workers: Math.max(1, Number(parserSettings.local_parser_file_workers) || 1),
        flush_enabled: !!parserSettings.flush_enabled,
        flush_every_docs: Math.max(1, Number(parserSettings.flush_every_docs) || 1),
      };
      const response = await apiService.updateParserSettings(payload);
      setParserSettings(response.settings);
      setUploadStatus('Parser settings saved.');
      setUploadDetails('New parsing settings will apply to future parse/index actions.');
      addDebugEntry('info', 'Parser settings saved');
      setIsParserSettingsOpen(false);
    } catch (error) {
      setParserSettingsError('Failed to save parser settings.');
      addDebugEntry('error', 'Failed to save parser settings');
    } finally {
      setIsSavingParserSettings(false);
    }
  };

  const loadParsedDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    setDocumentsError('');
    try {
      const response = await apiService.getParsedDocuments();
      const docs = Array.isArray(response.documents) ? response.documents : [];
      docs.sort((a, b) => a.filename.localeCompare(b.filename));
      setDocuments(docs);
      addDebugEntry('info', `Loaded ${docs.length} parsed document entries`);
    } catch (error) {
      setDocumentsError('Failed to load parsed documents.');
      addDebugEntry('error', 'Failed to load parsed documents');
    } finally {
      setIsDocumentsLoading(false);
    }
  }, [addDebugEntry]);

  const openDocumentsBox = async () => {
    setIsDocumentsBoxOpen(true);
    await loadParsedDocuments();
  };

  const closeDocumentsBox = () => {
    if (deleteInProgressKey) {
      return;
    }
    setIsDocumentsBoxOpen(false);
    setDocumentsError('');
    setDocumentsSearch('');
    setShowHiddenDocuments(false);
    setIsSelectMode(false);
    setSelectedDocuments([]);
  };

  const filteredDocuments = useMemo(() => {
    const queryText = documentsSearch.trim().toLowerCase();
    return documents.filter((document) => {
      if (!showHiddenDocuments && !document.in_index) {
        return false;
      }
      if (!queryText) {
        return true;
      }
      return document.filename.toLowerCase().includes(queryText);
    });
  }, [documents, documentsSearch, showHiddenDocuments]);

  const onDeleteDocument = async (document: ParsedDocument, target: 'index' | 'folder') => {
    const actionKey = `${document.filename}:${target}`;
    setDeleteInProgressKey(actionKey);
    try {
      await apiService.deleteParsedDocument(document.filename, target);
      setUploadStatus('Document updated.');
      if (target === 'index') {
        setUploadDetails(`Removed ${document.filename} from parsed index.`);
      } else {
        setUploadDetails(`Removed ${document.filename} from uploaded docs folder.`);
      }
      addDebugEntry('info', `Deleted ${document.filename} from ${target}`);
      await loadParsedDocuments();
    } catch (error) {
      setDocumentsError('Failed to delete document for selected target.');
      addDebugEntry('error', `Delete failed for ${document.filename} from ${target}`);
    } finally {
      setDeleteInProgressKey(null);
    }
  };

  const toggleSelectedDocument = (filename: string) => {
    setSelectedDocuments((prev) => {
      if (prev.includes(filename)) {
        return prev.filter((item) => item !== filename);
      }
      return [...prev, filename];
    });
  };

  const onToggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedDocuments([]);
  };

  const onSelectAllVisible = () => {
    const visibleNames = filteredDocuments.map((document) => document.filename);
    setSelectedDocuments((prev) => {
      const areAllSelected = visibleNames.length > 0 && visibleNames.every((name) => prev.includes(name));
      if (areAllSelected) {
        return prev.filter((name) => !visibleNames.includes(name));
      }
      const merged = new Set([...prev, ...visibleNames]);
      return Array.from(merged);
    });
  };

  const onDeleteSelectedDocuments = async () => {
    if (selectedDocuments.length === 0) {
      return;
    }

    const selectedSet = new Set(selectedDocuments);
    const targets = documents.filter((document) => selectedSet.has(document.filename));
    setDeleteInProgressKey('bulk');
    setDocumentsError('');

    let updated = 0;
    for (const document of targets) {
      try {
        if (document.in_index) {
          await apiService.deleteParsedDocument(document.filename, 'index');
        }
        if (document.in_folder) {
          await apiService.deleteParsedDocument(document.filename, 'folder');
        }
        updated += 1;
      } catch (error) {
        setDocumentsError(`Some selected documents could not be deleted (stopped at ${document.filename}).`);
        break;
      }
    }

    if (updated > 0) {
      setUploadStatus('Selected documents updated.');
      setUploadDetails(`Deleted ${updated} selected document(s) from index/folder where available.`);
      addDebugEntry('info', `Bulk deleted ${updated} selected documents`);
    }

    await loadParsedDocuments();
    setSelectedDocuments([]);
    setDeleteInProgressKey(null);
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
        {isClearIndexDialogOpen && (
          <div className={styles['confirm-overlay']} role="presentation" onClick={onCancelClearIndex}>
            <div
              className={styles['confirm-dialog']}
              role="dialog"
              aria-modal="true"
              aria-label="Clear parsed cards"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className={styles['confirm-title']}>Clear Parsed Cards?</h3>
              <p className={styles['confirm-body']}>
                Choose what to clear.
              </p>
              <div className={styles['confirm-options']}>
                <label className={styles['confirm-option']}>
                  <input
                    type="checkbox"
                    checked={clearIndexSelected}
                    onChange={(event) => setClearIndexSelected(event.target.checked)}
                    disabled={isClearingIndex}
                  />
                  <span>Clear parsed cards from index</span>
                </label>
                <label className={styles['confirm-option']}>
                  <input
                    type="checkbox"
                    checked={clearFilesSelected}
                    onChange={(event) => setClearFilesSelected(event.target.checked)}
                    disabled={isClearingIndex}
                  />
                  <span>Delete uploaded .docx files</span>
                </label>
              </div>
              <div className={styles['confirm-actions']}>
                <button
                  type="button"
                  className={styles['confirm-cancel']}
                  onClick={onCancelClearIndex}
                  disabled={isClearingIndex}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles['confirm-danger']}
                  onClick={onConfirmClearIndex}
                  disabled={isClearingIndex || (!clearIndexSelected && !clearFilesSelected)}
                >
                  {isClearingIndex ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        )}
        {isDocumentsBoxOpen && (
          <div className={styles['confirm-overlay']} role="presentation" onClick={closeDocumentsBox}>
            <div
              className={styles['documents-dialog']}
              role="dialog"
              aria-modal="true"
              aria-label="Manage documents"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles['documents-header']}>
                <h3 className={styles['documents-title']}>Manage Documents</h3>
                <button type="button" className={styles['documents-close']} onClick={closeDocumentsBox} disabled={!!deleteInProgressKey}>Close</button>
              </div>
              <div className={styles['documents-controls']}>
                <input
                  type="text"
                  className={styles['documents-search']}
                  placeholder="Search parsed documents..."
                  value={documentsSearch}
                  onChange={(event) => setDocumentsSearch(event.target.value)}
                />
                <div className={styles['documents-actions-row']}>
                  <label className={styles['documents-toggle']}>
                    <input
                      type="checkbox"
                      checked={showHiddenDocuments}
                      onChange={(event) => setShowHiddenDocuments(event.target.checked)}
                    />
                    Show Hidden
                  </label>
                  <button
                    type="button"
                    className={styles['documents-select-btn']}
                    onClick={onToggleSelectMode}
                    disabled={!!deleteInProgressKey}
                  >
                    {isSelectMode ? 'Exit' : 'Select'}
                  </button>
                  {isSelectMode && (
                    <>
                      <button
                        type="button"
                        className={styles['documents-select-btn']}
                        onClick={onSelectAllVisible}
                        disabled={!!deleteInProgressKey || filteredDocuments.length === 0}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles['document-action-danger']}
                        onClick={onDeleteSelectedDocuments}
                        disabled={!!deleteInProgressKey || selectedDocuments.length === 0}
                      >
                        Delete Selected ({selectedDocuments.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
              {documentsError && <p className={styles['documents-error']}>{documentsError}</p>}
              {isDocumentsLoading && <p className={styles['documents-meta']}>Loading documents...</p>}
              {!isDocumentsLoading && documents.length === 0 && (
                <p className={styles['documents-meta']}>No parsed documents found.</p>
              )}
              {!isDocumentsLoading && documents.length > 0 && filteredDocuments.length === 0 && (
                <p className={styles['documents-meta']}>No documents match your current filters.</p>
              )}
              {!isDocumentsLoading && filteredDocuments.length > 0 && (
                <div className={styles['documents-list']}>
                  {filteredDocuments.map((document) => {
                    const indexKey = `${document.filename}:index`;
                    const folderKey = `${document.filename}:folder`;
                    return (
                      <div key={document.filename} className={styles['document-row']}>
                        {isSelectMode && (
                          <label className={styles['document-select']}>
                            <input
                              type="checkbox"
                              checked={selectedDocuments.includes(document.filename)}
                              onChange={() => toggleSelectedDocument(document.filename)}
                              disabled={!!deleteInProgressKey}
                            />
                          </label>
                        )}
                        <div className={styles['document-main']}>
                          <p className={styles['document-name']}>{document.filename}</p>
                          <p className={styles['document-meta']}>
                            cards: {document.cards_indexed} • in index: {document.in_index ? 'yes' : 'no'} • in folder: {document.in_folder ? 'yes' : 'no'}
                          </p>
                        </div>
                        <div className={styles['document-actions']}>
                          <button
                            type="button"
                            className={styles['document-action-secondary']}
                            disabled={!document.in_index || deleteInProgressKey !== null}
                            onClick={() => onDeleteDocument(document, 'index')}
                          >
                            {deleteInProgressKey === indexKey ? 'Removing…' : 'Remove from Index'}
                          </button>
                          <button
                            type="button"
                            className={styles['document-action-danger']}
                            disabled={!document.in_folder || deleteInProgressKey !== null}
                            onClick={() => onDeleteDocument(document, 'folder')}
                          >
                            {deleteInProgressKey === folderKey ? 'Removing…' : 'Delete File'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {isParserSettingsOpen && (
          <div className={styles['confirm-overlay']} role="presentation" onClick={closeParserSettings}>
            <div
              className={styles['parser-settings-dialog']}
              role="dialog"
              aria-modal="true"
              aria-label="Parser settings"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className={styles['confirm-title']}>Parser Settings</h3>
              {parserSettingsError && <p className={styles['documents-error']}>{parserSettingsError}</p>}

              <label className={styles['parser-settings-row']}>
                <span>Use parallel processing</span>
                <input
                  type="checkbox"
                  checked={parserSettings.use_parallel_processing}
                  onChange={(event) => setParserSettings((prev) => ({ ...prev, use_parallel_processing: event.target.checked }))}
                  disabled={isSavingParserSettings}
                />
              </label>

              <label className={styles['parser-settings-row']}>
                <span>Card workers (cores)</span>
                <input
                  type="number"
                  min={1}
                  className={styles['parser-settings-input']}
                  value={parserSettings.parser_card_workers}
                  onChange={(event) => setParserSettings((prev) => ({ ...prev, parser_card_workers: Number(event.target.value) || 1 }))}
                  disabled={isSavingParserSettings}
                />
              </label>

              <label className={styles['parser-settings-row']}>
                <span>File workers (cores)</span>
                <input
                  type="number"
                  min={1}
                  className={styles['parser-settings-input']}
                  value={parserSettings.local_parser_file_workers}
                  onChange={(event) => setParserSettings((prev) => ({ ...prev, local_parser_file_workers: Number(event.target.value) || 1 }))}
                  disabled={isSavingParserSettings}
                />
              </label>

              <label className={styles['parser-settings-row']}>
                <span>Enable periodic flush</span>
                <input
                  type="checkbox"
                  checked={parserSettings.flush_enabled}
                  onChange={(event) => setParserSettings((prev) => ({ ...prev, flush_enabled: event.target.checked }))}
                  disabled={isSavingParserSettings}
                />
              </label>

              <label className={styles['parser-settings-row']}>
                <span>Flush every N documents</span>
                <input
                  type="number"
                  min={1}
                  className={styles['parser-settings-input']}
                  value={parserSettings.flush_every_docs}
                  onChange={(event) => setParserSettings((prev) => ({ ...prev, flush_every_docs: Number(event.target.value) || 1 }))}
                  disabled={isSavingParserSettings || !parserSettings.flush_enabled}
                />
              </label>

              <div className={styles['confirm-actions']}>
                <button
                  type="button"
                  className={styles['confirm-cancel']}
                  onClick={closeParserSettings}
                  disabled={isSavingParserSettings}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles['confirm-danger']}
                  onClick={onSaveParserSettings}
                  disabled={isSavingParserSettings}
                >
                  {isSavingParserSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
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
            <button type="button" className={styles['manage-index']} onClick={openParserSettings}>Parser Settings</button>
            <button type="button" className={styles['manage-index']} onClick={openDocumentsBox}>Manage Documents</button>
            <button type="button" className={styles['clear-index']} onClick={onClearIndex}>Clear Parsed Cards</button>
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
