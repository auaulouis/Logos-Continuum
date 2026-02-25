/* eslint-disable jsx-a11y/anchor-is-valid */
import mixpanel from 'mixpanel-browser';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import ConnectDropboxButton from '../components/dropbox/ConnectDropboxButton';
import * as apiService from '../services/api';
import styles from '../styles/index.module.scss';

const IndexPage = () => {
  const [query, setQuery] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadDetails, setUploadDetails] = useState('');
  const backgroundCanvasElement = useRef<HTMLCanvasElement | null>(null);
  const uploadInputElement = useRef<HTMLInputElement | null>(null);
  const uploadDetailsElement = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();

  useEffect(() => {
   // mixpanel.track('Page View', {
     // page: 'Home',
   // });
  }, []);

  useEffect(() => {
    if (uploadDetailsElement.current) {
      uploadDetailsElement.current.scrollTop = uploadDetailsElement.current.scrollHeight;
    }
  }, [uploadDetails]);

  useEffect(() => {
    const canvasElement = backgroundCanvasElement.current;
    if (!canvasElement) {
      return;
    }

    const context = canvasElement.getContext('2d');
    if (!context) {
      return;
    }

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pointerTarget = { ...pointer };
    const pointerVelocity = { x: 0, y: 0 };
    const flow = { x: 0, y: 0 };
    const lastPointer = { ...pointer };
    const devicePixelRatio = window.devicePixelRatio || 1;
    const cellSize = 26;

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
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerTarget.x = event.clientX;
      pointerTarget.y = event.clientY;
      pointerVelocity.x = event.clientX - lastPointer.x;
      pointerVelocity.y = event.clientY - lastPointer.y;
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
    };

    const onPointerLeave = () => {
      pointerTarget.x = window.innerWidth / 2;
      pointerTarget.y = window.innerHeight / 2;
    };

    const drawFrame = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      pointer.x += (pointerTarget.x - pointer.x) * 0.14;
      pointer.y += (pointerTarget.y - pointer.y) * 0.14;
      flow.x += (pointerVelocity.x - flow.x) * 0.1;
      flow.y += (pointerVelocity.y - flow.y) * 0.1;
      pointerVelocity.x *= 0.85;
      pointerVelocity.y *= 0.85;

      context.clearRect(0, 0, width, height);
      context.fillStyle = '#f8f8ff';
      context.fillRect(0, 0, width, height);

      for (let y = 0; y <= height + cellSize; y += cellSize) {
        for (let x = 0; x <= width + cellSize; x += cellSize) {
          const cursorDx = x - pointer.x;
          const cursorDy = y - pointer.y;
          const cursorDist2 = cursorDx * cursorDx + cursorDy * cursorDy;
          const dragInfluence = Math.exp(-cursorDist2 / (2 * 210 * 210));

          const advectX = x - flow.x * (9 * dragInfluence);
          const advectY = y - flow.y * (9 * dragInfluence);
          const nx = advectX / width;
          const ny = advectY / height;

          let temperature = 0.32;
          temperature += 0.09 * Math.sin(nx * 8.4 + time * 0.00045);
          temperature += 0.08 * Math.cos(ny * 7.8 + time * 0.0004);
          temperature += 0.06 * Math.sin((nx + ny) * 9.2 + time * 0.0005);

          const coreHeat = Math.exp(-cursorDist2 / (2 * 105 * 105));
          const haloHeat = Math.exp(-cursorDist2 / (2 * 200 * 200));
          temperature += 0.68 * coreHeat;
          temperature += 0.18 * haloHeat;

          const wakeX = pointer.x - flow.x * 16;
          const wakeY = pointer.y - flow.y * 16;
          const wakeDx = x - wakeX;
          const wakeDy = y - wakeY;
          const wakeDist2 = wakeDx * wakeDx + wakeDy * wakeDy;
          temperature += 0.25 * Math.exp(-wakeDist2 / (2 * 300 * 300));

          anchors.forEach((anchor, index) => {
            const phase = time * (0.00018 + index * 0.00003);
            const anchorX = anchor.x * width + Math.sin(phase + index) * (flow.x * 4.5);
            const anchorY = anchor.y * height + Math.cos(phase + index) * (flow.y * 4.5);
            const dx = advectX - anchorX;
            const dy = advectY - anchorY;
            const dist2 = dx * dx + dy * dy;
            temperature += anchor.weight * Math.exp(-dist2 / (2 * anchor.radius * anchor.radius));
          });

          const clamped = Math.max(0, Math.min(1, temperature));
          const hue = 236 - clamped * 78 - coreHeat * 36;
          const saturation = 58 - clamped * 8;
          const lightness = 96 - clamped * 18;
          const alpha = 0.9;

          context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
          context.fillRect(x, y, cellSize + 1, cellSize + 1);
        }
      }

      context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      context.lineWidth = 1;
      for (let y = 0; y <= height + cellSize; y += cellSize * 2) {
        context.beginPath();
        context.moveTo(0, y + Math.sin(time * 0.0006 + y * 0.01) * 4);
        context.lineTo(width, y + Math.cos(time * 0.0006 + y * 0.01) * 4);
        context.stroke();
      }

      const orbRadius = 34;
      const orbGradient = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, orbRadius);
      orbGradient.addColorStop(0, 'hsla(154, 70%, 70%, 0.52)');
      orbGradient.addColorStop(0.55, 'hsla(154, 66%, 76%, 0.26)');
      orbGradient.addColorStop(1, 'hsla(154, 66%, 82%, 0)');
      context.fillStyle = orbGradient;
      context.beginPath();
      context.arc(pointer.x, pointer.y, orbRadius, 0, Math.PI * 2);
      context.fill();

      frameId = window.requestAnimationFrame(drawFrame);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    frameId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  const search = () => {
    if (query.trim().length > 0) {
      router.push(`/query?search=${encodeURI(query)}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  const onDocxUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.docx'));
    const invalidFiles = selectedFiles.filter((file) => !file.name.toLowerCase().endsWith('.docx'));

    setUploadStatus('Parsing uploaded file(s)...');
    if (validFiles.length > 0) {
      setUploadDetails(`Parsing now:\n${validFiles.map((file) => `- ${file.name}`).join('\n')}`);
    } else {
      setUploadDetails('No valid .docx files selected.');
      setUploadStatus('Parsed 0 file(s).');
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

    setUploadStatus(`Parsed ${succeeded} file(s). ${failed > 0 ? `${failed} failed.` : ''}`.trim());
    setUploadDetails([
      parsedNames.length > 0 ? `Parsed:\n${parsedNames.map((name) => `- ${name}`).join('\n')}` : '',
      failedNames.length > 0 ? `Failed parsing:\n${failedNames.map((name) => `- ${name}`).join('\n')}` : '',
      invalidNames.length > 0 ? `Skipped (not .docx):\n${invalidNames.map((name) => `- ${name}`).join('\n')}` : '',
    ].filter((block) => block.length > 0).join('\n\n'));
  };

  const onClearIndex = async () => {
    const isConfirmed = window.confirm('Warning: This will permanently clear all parsed cards from the local index. Continue?');
    if (!isConfirmed) {
      return;
    }

    try {
      await apiService.clearIndex();
      setUploadStatus('Index cleared.');
      setUploadDetails('All parsed cards were removed from the local index.');
    } catch (error) {
      setUploadStatus('Failed to clear index.');
    }
  };

  return (
    <>
      <Head>
        <title>Logos Continuum: A Debate Search Engine</title>
        <meta name="description" content="Search debate cards with Logos Continuum" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.container}>
        <canvas ref={backgroundCanvasElement} className={styles['temperature-map']} aria-hidden="true" />
        <div className={styles.foreground}>
        <div className={styles.panel}>
        {/* <ConnectDropboxButton /> */}

        <h1 className={styles.logo}>LOGOS CONTINUUM</h1>
        {/* <h2 className={styles.subtitle}>The platform has been disabled for the moment for maintenance and upgrades. We hope to be back soon!</h2> */}
        <h2 className={styles.subtitle}>a debate search platform</h2>

        <div className={styles.row}>
          <input onKeyDown={onKeyDown} className={styles.search} placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className={styles.submit} onClick={search}>Submit</button>
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
