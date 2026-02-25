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
        <title>Logos: A Debate Search Engine</title>
        <meta name="description" content="Search the wiki for cards" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.container}>
        {/* <ConnectDropboxButton /> */}

        <h1 className={styles.logo}>LOGOS</h1>
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
    </>
  );
};

export default IndexPage;
