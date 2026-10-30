"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, CheckCircle2, FileImage, Loader2, X, Trash2, ShieldCheck, DownloadCloud, Github, ArrowUp, Zap, Palette, Lock, Gem, AlertTriangle } from "lucide-react";
import { zipSync } from "fflate";

// Supported image types — GIF/AVIF/BMP/TIFF are intentionally excluded (canvas strips animation,
// AVIF decode is inconsistent across browsers, and the other formats have no useful output path).
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SUPPORTED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

// Types
type ProcessableFile = {
  id: string;
  file: File;
  status: "idle" | "processing" | "finalizing" | "done" | "error";
  resultUrl?: string;
  resultName?: string;
  resultSizeBytes?: number;
  originalSizeBytes: number;
  errorMsg?: string;
  format: string;
  maxSizeKb: number;
  maxWidth?: number;
  maxHeight?: number;
  progress?: number; // 0–12 iteration counter during binary search
  unsupported?: boolean;
};

type ProcessGlobals = {
  globalFormat: string;
  globalMaxSize: number;
  removeMeta: boolean;
  maxWidth?: number;
  maxHeight?: number;
};

// ─── helpers ───────────────────────────────────────────────────────────────────

/** Promisified canvas.toBlob — prevents simultaneous-toBlob race conditions on Firefox */
const blobAsync = (canvas: HTMLCanvasElement | OffscreenCanvas, mime: string, quality?: number): Promise<Blob> =>
  new Promise((res, rej) => {
    if (canvas instanceof HTMLCanvasElement) {
      canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob returned null")), mime, quality);
    } else {
      canvas.convertToBlob({ type: mime, quality }).then(res, rej);
    }
  });

/** Format bytes → human-readable string */
const fmtBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// UI Switch Component
function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: () => void; label: string; description: string }) {
  return (
    <div 
      className="flex items-center justify-between cursor-pointer group py-3 px-1 rounded-xl hover:bg-white/[0.03] transition-colors"
      onClick={onChange}
    >
      <div className="flex flex-col text-left pr-4">
        <h3 className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-1 font-bold">{description}</h3>
        <p className="text-sm font-medium text-white/90 group-hover:text-white">{label}</p>
      </div>
      <div className={`w-10 h-5 rounded-full relative transition-colors shadow-inner shrink-0 ${checked ? "bg-white" : "bg-white/20"}`}>
        <div className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${checked ? "translate-x-[22px] bg-black shadow-sm" : "translate-x-[2px] bg-white shadow-sm"}`}></div>
      </div>
    </div>
  );
}

// Background Noise Component
const NoiseOverlay = () => (
  <svg viewBox="0 0 200 200" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.03] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg">
    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
  </svg>
);

const TARGET_SIZES = [
  { label: 'Auto (Best Quality)', value: 0 },
  { label: '50 KB', value: 50 },
  { label: '100 KB', value: 100 },
  { label: '250 KB', value: 250 },
  { label: '500 KB', value: 500 },
  { label: '1 MB', value: 1024 },
  { label: '2 MB', value: 2048 },
  { label: '5 MB', value: 5120 },
  { label: 'Custom...', value: -1 },
];

const FORMATS = [
  { label: 'Original Format', value: 'auto' },
  { label: 'JPEG (.jpg)', value: 'image/jpeg' },
  { label: 'PNG (.png)', value: 'image/png' },
  { label: 'WEBP (.webp)', value: 'image/webp' },
];

// JPEG padding — adds COM (comment) marker(s) with filler bytes to reach target size.
// This does NOT alter any pixel data; decoders silently ignore the extra segment.
// The JPEG spec limits a single COM segment data payload to 65533 bytes, so we chunk
// across multiple COM markers if padding exceeds that.
const MAX_COM_DATA = 65533;
const padJpegToTarget = async (blob: Blob, targetBytes: number): Promise<Blob> => {
  if (blob.size >= targetBytes) return blob;
  const needed = targetBytes - blob.size;
  // Only pad if the result is already ≥ 50% of the target (avoid pathological over-padding)
  if (blob.size < targetBytes * 0.5) return blob;

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Find the SOS (FF DA) marker — insert COM right before it
  let sosIdx = -1;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xDA) { sosIdx = i; break; }
  }
  if (sosIdx === -1) return blob;

  // Build COM marker chunks (each: FF FE, 2-byte big-endian length, data)
  let remaining = needed;
  const comChunks: Uint8Array[] = [];
  while (remaining > 4) {
    const dataLen = Math.min(remaining - 4, MAX_COM_DATA);
    const chunk = new Uint8Array(4 + dataLen);
    chunk[0] = 0xFF; chunk[1] = 0xFE;
    chunk[2] = ((dataLen + 2) >> 8) & 0xFF;
    chunk[3] = (dataLen + 2) & 0xFF;
    chunk.fill(0x20, 4);
    comChunks.push(chunk);
    remaining -= 4 + dataLen;
  }
  if (comChunks.length === 0) return blob;

  const totalComSize = comChunks.reduce((s, c) => s + c.length, 0);
  const padded = new Uint8Array(bytes.length + totalComSize);
  padded.set(bytes.subarray(0, sosIdx));
  let offset = sosIdx;
  for (const chunk of comChunks) { padded.set(chunk, offset); offset += chunk.length; }
  padded.set(bytes.subarray(sosIdx), offset);

  return new Blob([padded], { type: 'image/jpeg' });
};

// ─── Core Processing Logic (In-Browser Only for data isolation) ────────────────
// processFile uses async/await loops (never recursion) to avoid stack overflows
// and same-canvas concurrent toBlob race conditions.
// Images are decoded with createImageBitmap(), which runs off the main thread in
// Chrome/Firefox/Safari 17+, avoiding main-thread jank and objectUrl leaks.
const MAX_ATTEMPTS = 12;

const processFile = async (
  pf: ProcessableFile,
  mode: 'SINGLE' | 'BATCH',
  globals: ProcessGlobals,
  onProgress?: (step: number) => void,
): Promise<{ blob: Blob; name: string; sizeBytes: number }> => {
  const targetSizeKb = mode === 'SINGLE' ? globals.globalMaxSize : pf.maxSizeKb;
  const targetFormat = mode === 'SINGLE' ? globals.globalFormat : pf.format;
  const userMaxW = (mode === 'SINGLE' ? globals.maxWidth : pf.maxWidth) || 0;
  const userMaxH = (mode === 'SINGLE' ? globals.maxHeight : pf.maxHeight) || 0;

  // When user wants no changes: no size target, keep original format, no metadata stripping, no dimension constraints
  const skipProcessing = targetSizeKb === 0 && targetFormat === 'auto' && !globals.removeMeta && userMaxW === 0 && userMaxH === 0;
  if (skipProcessing) {
    return { blob: pf.file, name: pf.file.name, sizeBytes: pf.file.size };
  }

  // Decode with createImageBitmap — off-thread in Chrome/Firefox/Safari 17+
  // No objectUrl needed, so there is no objectUrl leak on error.
  const bitmap = await createImageBitmap(pf.file);

  try {
    const canvas = document.createElement("canvas");
    let width = bitmap.width;
    let height = bitmap.height;

    // Apply user-defined dimension constraints first (if set, preserves aspect ratio)
    if (userMaxW > 0 && width > userMaxW) {
      height = Math.max(1, Math.round((height * userMaxW) / width));
      width = userMaxW;
    }
    if (userMaxH > 0 && height > userMaxH) {
      width = Math.max(1, Math.round((width * userMaxH) / height));
      height = userMaxH;
    }

    // Hard cap at 4000px to prevent memory issues with very large images
    if (width > 4000 || height > 4000) {
      const ratio = width / height;
      if (width > height) { width = 4000; height = Math.floor(4000 / ratio); }
      else { height = 4000; width = Math.floor(4000 * ratio); }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context initialization failed");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close(); // free GPU memory immediately

    const applyFormat = targetFormat === 'auto' ? (pf.file.type || 'image/jpeg') : targetFormat;
    const ext = applyFormat === 'image/jpeg' ? '.jpg' : (applyFormat === 'image/png' ? '.png' : '.webp');

    let baseName = pf.file.name;
    const lastDot = baseName.lastIndexOf(".");
    if (lastDot !== -1) baseName = baseName.substring(0, lastDot);
    const outName = baseName + ext;

    // Auto / Best Quality — export at high quality, no size target
    if (targetSizeKb === 0) {
      const blob = await blobAsync(canvas, applyFormat, 0.95);
      return { blob, name: outName, sizeBytes: blob.size };
    }

    const targetBytes = targetSizeKb * 1024;

    // ── PNG: dimension binary search (lossless, quality param ignored by browser) ──
    if (applyFormat === 'image/png') {
      let minScale = 0.1, maxScale = 1.0;
      let bestBlob: Blob | null = null;    // largest blob ≤ target
      let closestBlob: Blob | null = null; // closest to target overall
      let smallestBlob: Blob | null = null;

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        onProgress?.(i + 1);
        const scale = (minScale + maxScale) / 2;
        const cw = Math.max(1, Math.floor(width * scale));
        const ch = Math.max(1, Math.floor(height * scale));
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        const cctx = c.getContext("2d");
        if (!cctx) break;
        cctx.drawImage(canvas, 0, 0, cw, ch);
        const blob = await blobAsync(c, 'image/png');

        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (!closestBlob || Math.abs(blob.size - targetBytes) < Math.abs(closestBlob.size - targetBytes)) closestBlob = blob;

        if (blob.size <= targetBytes * 1.05) { bestBlob = blob; minScale = scale; }
        else maxScale = scale;

        if (maxScale - minScale < 0.01) break;
      }
      const result = bestBlob ?? closestBlob ?? smallestBlob!;
      return { blob: result, name: outName, sizeBytes: result.size };
    }

    // ── JPEG/WebP: Phase 1 — quality binary search ──
    const fileSizeBytes = pf.file.size || targetBytes * 2;
    const estimatedRatio = targetBytes / fileSizeBytes;
    const startQ = Math.min(0.95, Math.max(0.05, estimatedRatio * 2));

    let minQ = 0.05, maxQ = 1.0;
    let bestBlob: Blob | null = null;
    let closestBlob: Blob | null = null;
    let smallestBlob: Blob | null = null;
    let step = 0;

    const tryQ = async (q: number): Promise<void> => {
      onProgress?.(++step);
      const blob = await blobAsync(canvas, applyFormat, q);
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      if (!closestBlob || Math.abs(blob.size - targetBytes) < Math.abs(closestBlob.size - targetBytes)) closestBlob = blob;
      if (blob.size <= targetBytes * 1.05) { bestBlob = blob; minQ = q; }
      else maxQ = q;
    };

    await tryQ(startQ);
    for (let i = 1; i < MAX_ATTEMPTS && maxQ - minQ > 0.01; i++) {
      await tryQ((minQ + maxQ) / 2);
    }

    // Phase 2 — if quality search still can't reach target by > 20%, scale down dimensions
    let phase1Result = bestBlob ?? closestBlob ?? smallestBlob!;
    if (phase1Result.size > targetBytes * 1.2 && applyFormat !== 'image/png') {
      // Use the minimum quality found as fixed quality for dimension search
      const fixedQ = minQ;
      let minScale = 0.1, maxScale = 1.0;
      let bestScale = 1.0;
      let scBestBlob: Blob | null = null;
      let scClosestBlob: Blob | null = null;
      let scSmallestBlob: Blob | null = null;

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        onProgress?.(MAX_ATTEMPTS + i + 1);
        const scale = (minScale + maxScale) / 2;
        const cw = Math.max(1, Math.floor(width * scale));
        const ch = Math.max(1, Math.floor(height * scale));
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        const cctx = c.getContext("2d");
        if (!cctx) break;
        cctx.drawImage(canvas, 0, 0, cw, ch);
        const blob = await blobAsync(c, applyFormat, fixedQ);

        if (!scSmallestBlob || blob.size < scSmallestBlob.size) scSmallestBlob = blob;
        if (!scClosestBlob || Math.abs(blob.size - targetBytes) < Math.abs(scClosestBlob.size - targetBytes)) scClosestBlob = blob;

        if (blob.size <= targetBytes * 1.05) { scBestBlob = blob; minScale = scale; bestScale = scale; }
        else maxScale = scale;

        if (maxScale - minScale < 0.01) break;
      }
      phase1Result = scBestBlob ?? scClosestBlob ?? scSmallestBlob ?? phase1Result;
    }

    // JPEG padding: if result is smaller than target, pad with COM marker(s)
    if (applyFormat === 'image/jpeg' && phase1Result.size < targetBytes) {
      const padded = await padJpegToTarget(phase1Result, targetBytes).catch(() => phase1Result);
      return { blob: padded, name: outName, sizeBytes: padded.size };
    }

    return { blob: phase1Result, name: outName, sizeBytes: phase1Result.size };

  } catch (e) {
    bitmap.close();
    throw e;
  }
};

export default function PrismApp() {
  const [introState, setIntroState] = useState<number>(-1);
  const [files, setFiles] = useState<ProcessableFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [mode, setMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [globalFormat, setGlobalFormat] = useState('auto');
  const [globalMaxSize, setGlobalMaxSize] = useState(0);
  const [customSizeKb, setCustomSizeKb] = useState<string>('');
  const [customFileSizes, setCustomFileSizes] = useState<Record<string, string>>({});
  const [removeMeta, setRemoveMeta] = useState(true);

  const [workflowState, setWorkflowState] = useState<'idle' | 'processing' | 'finalizing' | 'ready_to_download'>('idle');
  const [scrollY, setScrollY] = useState(0);
  const [bgTheme, setBgTheme] = useState(() => {
    try { return Number(sessionStorage.getItem('prism_bg')) || 1; }
    catch { return 1; }
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const prismRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cycleTheme = useCallback(() => {
    const next = (bgTheme + 1) % 4;
    setBgTheme(next);
    try { sessionStorage.setItem('prism_bg', String(next)); } catch {}
    const names = ['✦ Nebula Orbs', '✦ Starfield', '✦ Vignette', '✦ Clean Minimal'];
    setToastMsg(names[next]);
    setTimeout(() => setToastMsg(null), 1800);
  }, [bgTheme]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intro Sequencing
  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem('prism_intro_seen')) {
        setIntroState(4);
        return;
      }
    } catch {}
    setIntroState(0);

    const s1 = setTimeout(() => { if (!cancelled) setIntroState(1); }, 800);
    const s2 = setTimeout(() => { if (!cancelled) setIntroState(2); }, 1600);
    const s3 = setTimeout(() => { if (!cancelled) setIntroState(3); }, 2400);
    const s4 = setTimeout(() => { if (!cancelled) { setIntroState(4); try { sessionStorage.setItem('prism_intro_seen', 'true'); } catch {} } }, 3600);
    return () => { cancelled = true; clearTimeout(s1); clearTimeout(s2); clearTimeout(s3); clearTimeout(s4); };
  }, []);

  // Cleanup on unload to protect local volatile memory session isolation
  useEffect(() => {
    const handleUnload = () => {
      files.forEach(f => { if (f.resultUrl) URL.revokeObjectURL(f.resultUrl); });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [files]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (workflowState !== 'idle') return;

    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    const newPfs: ProcessableFile[] = dropped.map(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      const unsupported = !SUPPORTED_TYPES.has(f.type) && !SUPPORTED_EXT.has(ext);
      return {
        id: Math.random().toString(36).slice(2, 9),
        file: f,
        status: "idle",
        format: globalFormat,
        maxSizeKb: globalMaxSize,
        originalSizeBytes: f.size,
        unsupported,
      };
    });
    setFiles(prev => [...prev, ...newPfs]);
  }, [workflowState, globalFormat, globalMaxSize]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (workflowState !== 'idle' || !e.target.files) return;
    const selected = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
    const newPfs: ProcessableFile[] = selected.map(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      const unsupported = !SUPPORTED_TYPES.has(f.type) && !SUPPORTED_EXT.has(ext);
      return {
        id: Math.random().toString(36).slice(2, 9),
        file: f,
        status: "idle",
        format: globalFormat,
        maxSizeKb: globalMaxSize,
        originalSizeBytes: f.size,
        unsupported,
      };
    });
    setFiles(prev => [...prev, ...newPfs]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    if (workflowState !== 'idle') return;
    setFiles(prev => {
       const toRemove = prev.find(f => f.id === id);
       if (toRemove?.resultUrl) URL.revokeObjectURL(toRemove.resultUrl);
       return prev.filter(f => f.id !== id);
    });
    setCustomFileSizes(prev => { const { [id]: _, ...rest } = prev; return rest; });
  };
  
  const updateFile = (id: string, updates: Partial<ProcessableFile>) => {
    if (workflowState !== 'idle') return;
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const clearQueue = () => {
    if (workflowState === 'processing' || workflowState === 'finalizing') return;
    files.forEach(f => { if (f.resultUrl) URL.revokeObjectURL(f.resultUrl); });
    setFiles([]);
    setCustomSizeKb('');
    setCustomFileSizes({});
    setWorkflowState('idle');
  };

  const downloadAll = async () => {
    const done = files.filter(f => f.status === "done" && f.resultUrl && f.resultName);
    if (done.length === 0) return;

    if (done.length === 1) {
      // Single file — direct download
      const a = document.createElement("a");
      a.href = done[0].resultUrl!;
      a.download = done[0].resultName!;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Multiple files — ZIP via fflate (level 0 = store, images are already compressed)
    const entries: Record<string, Uint8Array> = {};
    for (const f of done) {
      const buf = await fetch(f.resultUrl!).then(r => r.arrayBuffer());
      // Deduplicate filenames by adding suffix if needed
      let name = f.resultName!;
      if (name in entries) {
        const dot = name.lastIndexOf('.');
        name = dot !== -1 ? `${name.slice(0, dot)}_${f.id}${name.slice(dot)}` : `${name}_${f.id}`;
      }
      entries[name] = new Uint8Array(buf);
    }
    const zipped = zipSync(entries, { level: 0 });
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prism-export.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const [globalMaxWidth, setGlobalMaxWidth] = useState<string>('');
  const [globalMaxHeight, setGlobalMaxHeight] = useState<string>('');

  const isCustomSizeValid = globalMaxSize !== -1 || (
    customSizeKb.trim() !== '' &&
    !isNaN(Number(customSizeKb)) &&
    Number(customSizeKb) >= 1 &&
    Number(customSizeKb) <= 102400
  );

  const areBatchCustomSizesValid = mode !== 'BATCH' || files.every(f => {
    if (f.maxSizeKb !== -1) return true;
    const val = Number(customFileSizes[f.id]);
    return !isNaN(val) && val >= 1 && val <= 102400;
  });

  const canProcess = files.length > 0 && workflowState === 'idle' && isCustomSizeValid && areBatchCustomSizesValid;

  const processAll = async () => {
    if (!canProcess) return;
    
    setWorkflowState('processing');

    const effectiveMaxW = Number(globalMaxWidth) || 0;
    const effectiveMaxH = Number(globalMaxHeight) || 0;
    const CONCURRENCY = 3;
    const items = [...files];

    // Controlled concurrency queue (max 3 in parallel to avoid device OOM)
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (pf) => {
          setFiles(prev => prev.map(p => p.id === pf.id ? { ...p, status: "processing", progress: 0 } : p));
          try {
            const effectiveSize = mode === 'SINGLE'
              ? (globalMaxSize === -1 ? (Number(customSizeKb) || 0) : globalMaxSize)
              : (pf.maxSizeKb === -1 ? (Number(customFileSizes[pf.id]) || 0) : pf.maxSizeKb);

            const pfWithSize: ProcessableFile = {
              ...pf,
              maxSizeKb: effectiveSize,
              maxWidth: mode === 'SINGLE' ? effectiveMaxW : (pf.maxWidth ?? effectiveMaxW),
              maxHeight: mode === 'SINGLE' ? effectiveMaxH : (pf.maxHeight ?? effectiveMaxH),
            };

            const processed = await processFile(
              pfWithSize,
              mode,
              {
                globalFormat,
                globalMaxSize: effectiveSize,
                removeMeta,
                maxWidth: effectiveMaxW,
                maxHeight: effectiveMaxH,
              },
              (step) => {
                setFiles(prev => prev.map(p => p.id === pf.id ? { ...p, progress: step } : p));
              }
            );

            const url = URL.createObjectURL(processed.blob);
            setFiles(prev => prev.map(p => p.id === pf.id ? {
              ...p,
              status: "finalizing",
              resultUrl: url,
              resultName: processed.name,
              resultSizeBytes: processed.sizeBytes,
              progress: MAX_ATTEMPTS,
            } : p));
          } catch (e: any) {
            setFiles(prev => prev.map(p => p.id === pf.id ? {
              ...p,
              status: "error",
              errorMsg: e?.message || "Processing failed",
            } : p));
          }
        })
      );
    }

    setWorkflowState('finalizing');

    // 2. Cinematic Finalizing Delay (1.2 seconds)
    await new Promise(r => setTimeout(r, 1200));

    // 3. Mark as done & await user download action
    setFiles(prev => prev.map(f => f.status === 'finalizing' ? { ...f, status: 'done' } : f));
    setWorkflowState('ready_to_download');
  };

  const hasFiles = files.length > 0;

  const TOOLS = [
    { href: "/remove-metadata", title: "Remove Image Metadata", description: "Strip EXIF, GPS, and camera data from your images" },
    { href: "/remove-exif", title: "Remove EXIF Data", description: "Delete all hidden metadata from photos" },
    { href: "/resize", title: "Image Resizer", description: "Reduce file size and dimensions to your target" },
    { href: "/compress", title: "Image Compressor", description: "Compress JPEG, PNG, and WebP efficiently" },
    { href: "/png-to-jpg", title: "PNG to JPG Converter", description: "Convert PNG images to smaller JPG files" },
    { href: "/jpg-to-png", title: "JPG to PNG Converter", description: "Convert JPG to lossless PNG format" },
    { href: "/webp-converter", title: "WebP Converter", description: "Convert to and from the modern WebP format" },
  ];
  
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-[#F5F5F7] overflow-x-hidden relative scroll-smooth py-8 sm:py-12">
      <NoiseOverlay />
      
      {/* Background Theme Layer */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Base white blobs (common to all themes except Nebula) */}
        {bgTheme !== 0 && (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vh] bg-white rounded-full blur-[150px] opacity-10" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vh] bg-white rounded-full blur-[150px] opacity-10" />
          </>
        )}

        {/* 0 — Nebula Orbs */}
        {bgTheme === 0 && (
          <>
            <div className="absolute top-[-10%] left-[-5%] w-[60vw] h-[60vw] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(120,80,255,0.25) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(0,180,255,0.15) 0%, transparent 70%)' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(255,120,200,0.1) 0%, transparent 70%)' }} />
          </>
        )}

        {/* 1 — Starfield (default) */}
        {bgTheme === 1 && (
          <div className="absolute inset-0 stars-bg" />
        )}

        {/* 2 — Vignette */}
        {bgTheme === 2 && (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)' }} />
        )}
        {/* 3 — Clean Minimal: just the base blobs above, no extra layer */}
      </div>

      <AnimatePresence mode="wait">
        {introState >= 0 && introState < 4 && (
           <motion.div
             key="intro"
             className="fixed inset-0 flex items-center justify-center z-50 bg-[#050505]"
             exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
             transition={{ duration: 1.2, ease: "easeInOut" }}
           >
              <div className="flex flex-col items-center justify-center text-center">
                <AnimatePresence mode="wait">
                  {introState === 0 && <motion.p key="0" initial={{ opacity: 0, filter: "blur(10px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0 }} className="text-white/60 tracking-[0.4em] text-xs uppercase font-mono">Initializing Local Environment...</motion.p>}
                  {introState === 1 && <motion.p key="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-white/80 tracking-[0.4em] text-xs uppercase font-mono">Securing Volatile Memory Vaults...</motion.p>}
                  {introState === 2 && <motion.p key="2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-white font-bold tracking-[0.4em] text-sm uppercase">AES-256 Isolation Confirmed / No Data Stored</motion.p>}
                  {introState === 3 && (
                     <motion.div key="3" initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8 }} className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-[0.6em] text-white/40 mb-2 font-bold font-mono">System Ready</span>
                        <h1 className="text-5xl md:text-7xl font-light tracking-tighter">NEBULOUS</h1>
                     </motion.div>
                  )}
                </AnimatePresence>
              </div>
           </motion.div>
        )}

        {introState === 4 && (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 20, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full max-w-[1440px] mx-auto flex flex-col z-10 px-3 sm:px-6 relative"
          >
            {/* App section with viewport fill */}
            <div className="flex flex-col min-h-screen lg:min-h-0 lg:h-[85vh] lg:max-h-[800px]">

              {/* Header */}
              <header className="flex justify-between items-end pb-6 shrink-0 z-20">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.5em] text-white/40 mb-1 font-semibold flex items-center gap-2">
                     <ShieldCheck className="w-3 h-3 text-white/60" /> Zero-Server Image Processing
                  </span>
                  <h1 className="text-2xl font-light tracking-tighter">NEBULOUS<span className="font-bold">.PRISM</span></h1>
                </div>
                <a
                  href="https://github.com/Gokulnaath17/Gokulnaath17-Nebulous-Prism"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 transition-all text-xs font-medium text-white/70 hover:text-white"
                  aria-label="View source code on GitHub"
                >
                  <Github className="w-4 h-4" />
                  <span className="hidden sm:inline">Source</span>
                </a>
              </header>

              {/* Core Split Layout with staggered cards */}
              <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0 relative z-20">
                
                {/* === LEFT CARD: Inputs & Queue === */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                  className="flex-1 flex flex-col min-w-0 bg-white/[0.02] border border-white/5 rounded-[2rem] shadow-2xl backdrop-blur-3xl overflow-hidden min-h-[500px] lg:min-h-0 flex-shrink-0 card-accent glow-pulse"
                >
                  <div className="p-4 sm:p-6 flex flex-col h-full min-h-0">
                    {/* Dropzone Area */}
                    <div 
                      className={`shrink-0 w-full h-[120px] lg:h-[140px] rounded-2xl border transition-all duration-500 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group
                        ${isDragOver ? "bg-white/[0.04] border-white/40 scale-[1.01]" : "bg-black/30 border-white/10 hover:border-white/30 hover:bg-white/[0.03]"}
                      `}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => workflowState === 'idle' && document.getElementById('fileUpload')?.click()}
                    >
                      <input type="file" id="fileUpload" multiple className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} disabled={workflowState !== 'idle'} />
                      {isDragOver && <div className="absolute inset-2 border border-dashed border-white/20 rounded-xl pointer-events-none" />}
                      
                      <UploadCloud className={`w-8 h-8 lg:w-10 lg:h-10 mb-2 transition-colors ${isDragOver ? "text-white" : "text-white/40 group-hover:text-white/80"}`} strokeWidth={1} />
                      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-medium text-white/50 group-hover:text-white/80 transition-colors text-center px-4">
                         Drop visual assets here or click to browse
                      </p>
                    </div>

                    {/* Context Header */}
                    <div className="flex items-center justify-between pt-6 pb-4 shrink-0">
                      <div className="flex items-center gap-3">
                         <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                           Transmission Queue
                         </h4>
                         <span className="text-[11px] font-mono text-white/40">{files.length} ITEMS</span>
                      </div>
                      {hasFiles && workflowState === 'idle' && (
                         <button onClick={clearQueue} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.1em] text-white/40 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                           <Trash2 className="w-3.5 h-3.5" /> Purge Cache
                         </button>
                      )}
                    </div>

                    {/* Processing Queue List */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden pr-3 custom-scrollbar flex flex-col gap-3 pb-2 relative">
                      {files.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/20 min-h-[200px]">
                          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-center">Standby.<br/><span className="font-light tracking-[0.1em] opacity-60">Awaiting user input vectors.</span></p>
                        </div>
                      ) : (
                        <AnimatePresence>
                          {files.map(pf => (
                            <motion.div 
                              key={pf.id}
                              initial={{ opacity: 0, scale: 0.98, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
                              layout
                              className="bg-black/40 border border-white/5 hover:bg-white/[0.04] rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors relative overflow-hidden shrink-0 group"
                            >
                              {pf.status === "processing" && (
                                <div
                                  style={{ width: `${Math.min(100, Math.round(((pf.progress || 1) / MAX_ATTEMPTS) * 100))}%` }}
                                  className="absolute bottom-0 left-0 h-[2px] bg-white/70 transition-all duration-150"
                                />
                              )}
                              {pf.status === "finalizing" && (
                                <motion.div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 size-full animate-[shimmer_1.5s_infinite]" />
                              )}

                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                                {pf.status === "processing" ? <Loader2 className="w-5 h-5 animate-spin text-white/50" /> 
                                 : pf.status === "finalizing" ? <DownloadCloud className="w-5 h-5 text-white/70 animate-pulse" /> 
                                 : <FileImage className="w-5 h-5 text-white/50" strokeWidth={1} />}
                              </div>
                              
                              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                <p className="text-[13px] font-medium text-white/90 truncate">{pf.file.name}</p>
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono flex-wrap">
                                   {pf.status === "processing" && (
                                     <span className="text-white/70 flex items-center gap-1.5">
                                       Executing algorithms...
                                       {pf.progress ? <span className="text-white/40">({Math.min(pf.progress, MAX_ATTEMPTS)}/{MAX_ATTEMPTS})</span> : null}
                                     </span>
                                   )}
                                   {pf.status === "finalizing" && <span className="text-white/80">Packaging payload...</span>}
                                   {pf.status === "done" && (
                                     <span className="text-white/80 flex items-center gap-1.5 flex-wrap">
                                       <span className="text-white/40">{fmtBytes(pf.originalSizeBytes)}</span>
                                       <span className="text-white/30">→</span>
                                       <span className="text-emerald-400 font-semibold">{fmtBytes(pf.resultSizeBytes ?? 0)}</span>
                                       {pf.originalSizeBytes > 0 && pf.resultSizeBytes !== undefined && (
                                         <span className="text-emerald-400/90 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 font-bold lowercase">
                                           {pf.resultSizeBytes <= pf.originalSizeBytes
                                             ? `↓ ${Math.round(((pf.originalSizeBytes - pf.resultSizeBytes) / pf.originalSizeBytes) * 100)}%`
                                             : `↑ ${Math.round(((pf.resultSizeBytes - pf.originalSizeBytes) / pf.originalSizeBytes) * 100)}%`}
                                         </span>
                                       )}
                                     </span>
                                   )}
                                   {pf.status === "error" && <span className="text-red-400">{pf.errorMsg || "Exception thrown"}</span>}
                                   {pf.status === "idle" && (
                                     <div className="flex items-center gap-2">
                                       <span className="text-white/30 font-medium">Vol: {fmtBytes(pf.originalSizeBytes)}</span>
                                       {pf.unsupported && (
                                         <span className="text-amber-400/90 text-[9px] flex items-center gap-1 font-mono uppercase bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                                           <AlertTriangle className="w-2.5 h-2.5" /> Static only
                                         </span>
                                       )}
                                     </div>
                                   )}
                                </div>
                              </div>

                              {mode === 'BATCH' && pf.status === 'idle' && (
                                 <div className="flex gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 sm:border-transparent">
                                    <select 
                                      value={pf.format} 
                                      onChange={(e) => updateFile(pf.id, { format: e.target.value })}
                                      className="bg-black/50 border border-white/10 rounded-lg py-2 px-2 text-[11px] font-medium tracking-wide text-white/80 outline-none hover:border-white/30 transition-colors w-full sm:w-[100px] appearance-none cursor-pointer text-center"
                                    >
                                      {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label.split(' ')[0]}</option>)}
                                    </select>
                                     <select 
                                       value={pf.maxSizeKb} 
                                       onChange={(e) => updateFile(pf.id, { maxSizeKb: Number(e.target.value) })}
                                       className="bg-black/50 border border-white/10 rounded-lg py-2 px-2 text-[11px] font-medium tracking-wide text-white/80 outline-none hover:border-white/30 transition-colors w-full sm:w-[80px] appearance-none cursor-pointer text-center"
                                     >
                                       {TARGET_SIZES.map(f => <option key={f.value} value={f.value}>{f.label === 'Custom...' ? 'Custom' : f.label}</option>)}
                                     </select>
                                     {pf.maxSizeKb === -1 && (
                                       <input
                                         type="number"
                                         min="1"
                                         max="102400"
                                         value={customFileSizes[pf.id] || ''}
                                         onChange={(e) => setCustomFileSizes(prev => ({ ...prev, [pf.id]: e.target.value }))}
                                         placeholder="KB"
                                         className={`bg-black/50 border rounded-lg py-2 px-2 text-[11px] font-medium tracking-wide text-white/80 outline-none transition-colors w-full sm:w-[80px] text-center ${
                                           customFileSizes[pf.id] && (Number(customFileSizes[pf.id]) < 1 || Number(customFileSizes[pf.id]) > 102400)
                                             ? "border-red-500/60"
                                             : "border-white/10 hover:border-white/30"
                                         }`}
                                       />
                                     )}
                                 </div>
                              )}

                              {pf.status === 'idle' && (
                                <button onClick={() => removeFile(pf.id)} className="absolute sm:static top-3 flex sm:flex items-center justify-center right-3 sm:right-auto w-8 h-8 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-colors shrink-0">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              {pf.status === 'done' && (
                                <div className="absolute sm:static top-3 right-3 sm:right-auto flex items-center gap-2">
                                  <a href={pf.resultUrl} download={pf.resultName} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
                                    <DownloadCloud className="w-4 h-4" />
                                  </a>
                                  <CheckCircle2 className="w-5 h-5 text-white/30 shrink-0" strokeWidth={1.5} />
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* === RIGHT CARD: Config & Automation === */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35, duration: 0.8, ease: "easeOut" }}
                  className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white/[0.02] border border-white/5 rounded-[2rem] shadow-2xl backdrop-blur-3xl shrink-0 min-h-[500px] lg:min-h-0 flex-shrink-0 overflow-hidden card-accent glow-pulse"
                >
                    <div className="flex-1 p-6 sm:p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                        <div className="shrink-0">
                           <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-4 font-bold flex items-center gap-2">
                              Operation Matrix
                           </h3>
                           <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 relative overflow-hidden">
                              <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-lg transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm ${mode === 'SINGLE' ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]'}`}></div>
                              <button 
                                onClick={() => workflowState === 'idle' && setMode('SINGLE')}
                                className={`flex-1 relative z-10 text-[11px] font-bold tracking-widest uppercase py-3 rounded-lg transition-colors ${mode === 'SINGLE' ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
                              >
                                Universal
                              </button>
                              <button 
                                onClick={() => workflowState === 'idle' && setMode('BATCH')}
                                className={`flex-1 relative z-10 text-[11px] font-bold tracking-widest uppercase py-3 rounded-lg transition-colors ${mode === 'BATCH' ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
                              >
                                Individual
                              </button>
                           </div>
                           <p className="text-[11px] text-white/30 mt-4 leading-relaxed font-medium">
                             {mode === 'SINGLE' ? "Universal configuration deployed to all operational assets securely. Per-file configurations are retained if you switch back." : "Unlock individual parameter modification for each payload item in queue."}
                           </p>
                        </div>

                        <div className="w-full h-px bg-white/5 shrink-0"></div>

                        <div className={`flex flex-col gap-6 transition-all duration-500 shrink-0 ${mode === 'BATCH' ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
                           <div className="group">
                              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 mb-3 block group-hover:text-white/60 transition-colors">Target Output Protocol</label>
                              <div className="relative">
                                 <select 
                                   value={globalFormat}
                                   onChange={(e) => setGlobalFormat(e.target.value)}
                                   className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-sm font-medium text-white/90 outline-none hover:border-white/30 focus:border-white/50 transition-colors appearance-none cursor-pointer"
                                 >
                                    {FORMATS.map(f => <option key={f.value} value={f.value} className="bg-black text-white">{f.label}</option>)}
                                 </select>
                                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                   <span className="opacity-40 text-xs">▼</span>
                                 </div>
                              </div>
                           </div>
                           
                           <div className="group">
                              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 mb-3 block group-hover:text-white/60 transition-colors">Maximum Object Footprint</label>
                              <div className="relative">
                                 <select 
                                   value={globalMaxSize}
                                   onChange={(e) => setGlobalMaxSize(Number(e.target.value))}
                                   className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-sm font-medium text-white/90 outline-none hover:border-white/30 focus:border-white/50 transition-colors appearance-none cursor-pointer"
                                 >
                                    {TARGET_SIZES.map(f => <option key={f.value} value={f.value} className="bg-black text-white">{f.label}</option>)}
                                 </select>
                                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                   <span className="opacity-40 text-xs">▼</span>
                                 </div>
                              </div>
                              {globalMaxSize === -1 && (
                                <div className="mt-3">
                                  <input
                                    type="number"
                                    min="1"
                                    max="102400"
                                    value={customSizeKb}
                                    onChange={(e) => setCustomSizeKb(e.target.value)}
                                    placeholder="Enter size in KB (e.g. 500)"
                                    className={`w-full bg-black/30 border rounded-xl px-4 py-3 text-sm font-medium text-white/90 outline-none transition-colors ${
                                      customSizeKb && (Number(customSizeKb) < 1 || Number(customSizeKb) > 102400)
                                        ? "border-red-500/60 focus:border-red-500"
                                        : "border-white/10 hover:border-white/30 focus:border-white/50"
                                    }`}
                                  />
                                  {customSizeKb && (Number(customSizeKb) < 1 || Number(customSizeKb) > 102400) ? (
                                    <p className="text-[10px] text-red-400 mt-1.5 font-mono">Value must be between 1 KB and 102,400 KB (100 MB)</p>
                                  ) : (
                                    <p className="text-[10px] text-white/40 mt-1.5 font-mono">Enter target size in Kilobytes (1 - 102,400)</p>
                                  )}
                                </div>
                              )}
                           </div>

                           {/* Dimension Constraints (Section 1.7) */}
                           <div className="group">
                              <div className="flex items-center justify-between mb-3">
                                <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 group-hover:text-white/60 transition-colors">
                                  Dimension Bounds (Optional)
                                </label>
                                {(globalMaxWidth || globalMaxHeight) && (
                                  <button 
                                    type="button" 
                                    onClick={() => { setGlobalMaxWidth(''); setGlobalMaxHeight(''); }}
                                    className="text-[9px] text-white/40 hover:text-white uppercase tracking-wider font-mono cursor-pointer"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <input
                                    type="number"
                                    min="1"
                                    max="8000"
                                    value={globalMaxWidth}
                                    onChange={(e) => setGlobalMaxWidth(e.target.value)}
                                    placeholder="Max W px"
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-xs font-medium text-white/90 outline-none hover:border-white/30 focus:border-white/50 transition-colors text-center font-mono"
                                  />
                                  <span className="text-[9px] text-white/30 font-mono block text-center mt-1">Width (px)</span>
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    min="1"
                                    max="8000"
                                    value={globalMaxHeight}
                                    onChange={(e) => setGlobalMaxHeight(e.target.value)}
                                    placeholder="Max H px"
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-xs font-medium text-white/90 outline-none hover:border-white/30 focus:border-white/50 transition-colors text-center font-mono"
                                  />
                                  <span className="text-[9px] text-white/30 font-mono block text-center mt-1">Height (px)</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-white/30 mt-2 font-mono leading-tight">
                                Preserves aspect ratio. Downscales if larger.
                              </p>
                           </div>
                        </div>

                        <div className="w-full h-px bg-white/5 shrink-0"></div>

                        <div className="shrink-0">
                           <Switch checked={removeMeta} onChange={() => workflowState === 'idle' && setRemoveMeta(!removeMeta)} label="Sanitize Core Metadata" description="Privacy Directive" />
                        </div>

                        {hasFiles && (workflowState === 'idle' || workflowState === 'ready_to_download') && (
                          <button onClick={clearQueue} className="flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-[0.15em] text-white/40 hover:text-red-400 transition-colors py-3 px-4 rounded-xl hover:bg-white/5 border border-white/5 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" /> Clear Memory
                          </button>
                        )}

                        <div className="w-full h-px bg-white/5 shrink-0"></div>
                        {workflowState === 'ready_to_download' ? (
                          <button 
                            onClick={downloadAll}
                            className="mt-auto shrink-0 h-[80px] w-full rounded-[2rem] bg-white text-black text-[13px] font-bold uppercase tracking-[0.2em] flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] shadow-[0_0_50px_rgba(255,255,255,0.15)] relative overflow-hidden group cursor-pointer"
                          >
                            <div className="absolute inset-0 bg-black/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
                            <span className="relative z-10 flex items-center gap-3">
                              <DownloadCloud className="w-5 h-5 text-black" />
                              {files.filter(f => f.status === 'done').length > 1 ? "Download All as ZIP" : "Download File"}
                            </span>
                          </button>
                        ) : (
                          <button 
                            disabled={!canProcess}
                            onClick={processAll}
                            className="mt-auto shrink-0 h-[80px] w-full rounded-[2rem] bg-white text-black text-[13px] font-bold uppercase tracking-[0.4em] flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_50px_rgba(255,255,255,0.08)] relative overflow-hidden group cursor-pointer"
                          >
                            <div className="absolute inset-0 bg-black/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
                            
                            <span className="relative z-10 flex items-center gap-3">
                              {workflowState === 'processing' ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Compiling Assets</>
                              ) : workflowState === 'finalizing' ? (
                                <><DownloadCloud className="w-5 h-5 animate-pulse" /> Packaging Payloads</>
                              ) : (
                                 "Process Items"
                              )}
                            </span>
                          </button>
                        )}
                    </div>
                </motion.div>

              </div>
            </div>

            {/* Mobile Scroll Prompt */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="lg:hidden w-full py-8 flex justify-center text-white/30 animate-bounce"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </motion.div>

            {/* SEO Content */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              className="w-full py-16 sm:py-24 z-10 relative"
            >
              <div className="max-w-4xl mx-auto space-y-16">
                {/* Feature Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: Lock, value: '100%', label: 'Client-Side' },
                    { icon: Zap, value: '0 ms', label: 'Server Latency' },
                    { icon: ShieldCheck, value: 'Zero', label: 'Data Uploads' },
                    { icon: Palette, value: '3', label: 'Formats' },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
                        className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5 text-center stat-item hover:bg-white/[0.04] hover:border-white/10 transition-all"
                      >
                        <Icon className="w-5 h-5 mx-auto mb-2 text-white/40" strokeWidth={1} />
                        <p className="text-lg sm:text-xl font-bold tracking-tight text-white/90">{stat.value}</p>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 mt-1">{stat.label}</p>
                      </motion.div>
                    );
                  })}
                </div>

                <div>
                  <h2 className="text-3xl sm:text-4xl font-light tracking-tighter mb-6">Browser-Based Image Processing, Completely Private</h2>
                  <p className="text-white/60 leading-relaxed text-base sm:text-lg">
                    Prism is a privacy-first image utility that runs entirely in your browser. No images are ever uploaded to any server.
                    All processing — metadata removal, resizing, compression, and format conversion — happens locally on your device
                    using the HTML5 Canvas API. Your files never leave your computer.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 card-accent hover:bg-white/[0.04] hover:border-white/10 transition-all">
                    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-3">What is EXIF metadata?</h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      EXIF (Exchangeable Image File Format) metadata is hidden data embedded in images by cameras and phones.
                      It includes GPS coordinates, device information, timestamps, and camera settings. This data can leak
                      personal information when you share photos online.
                    </p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 card-accent hover:bg-white/[0.04] hover:border-white/10 transition-all">
                    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-3">Why remove metadata?</h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      Removing image metadata protects your privacy. GPS coordinates reveal where you live or work. Camera serial
                      numbers can identify your device. Timestamps expose your daily routine. Stripping this data ensures you
                      share only the visual content you intend to.
                    </p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 card-accent hover:bg-white/[0.04] hover:border-white/10 transition-all">
                    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-3">Is image processing private?</h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      Yes. Every operation in Prism runs client-side. Your images are processed using canvas elements in your
                      browser and are never transmitted to any server. No data is stored, logged, or accessible to anyone
                      but you. Privacy is not a feature — it is the foundation of this tool.
                    </p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 card-accent hover:bg-white/[0.04] hover:border-white/10 transition-all">
                    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50 mb-3">Supported image formats</h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      Prism supports JPEG (.jpg), PNG (.png), and WebP (.webp) formats. You can convert between formats,
                      resize to specific file sizes, remove metadata, and process multiple images in batch mode — all
                      with complete privacy.
                    </p>
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl sm:text-4xl font-light tracking-tighter mb-6">All Image Tools</h2>
                  <div className="overflow-hidden mask-edges">
                    <div className="flex gap-4 marquee-track">
                      {[...TOOLS, ...TOOLS].map((tool, i) => (
                        <a
                          key={`${tool.href}-${i}`}
                          href={tool.href}
                          className="block bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] hover:border-white/20 transition-all shrink-0 w-[240px] sm:w-[260px]"
                        >
                          <h3 className="text-sm font-medium text-white/90 mb-1">{tool.title}</h3>
                          <p className="text-xs text-white/40">{tool.description}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Footer */}
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="w-full border-t border-white/5 z-10 relative"
            >
              <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pb-8 border-b border-white/5">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-3">Prism</h4>
                    <p className="text-xs text-white/30 leading-relaxed">
                      Privacy-first browser-based image processing. All operations run 100% client-side.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-3">Tools</h4>
                    <ul className="space-y-1.5">
                      {TOOLS.map(tool => (
                        <li key={tool.href}>
                          <a href={tool.href} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                            {tool.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col items-start gap-3">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-1">Connect</h4>
                    <a
                      href="https://github.com/Gokulnaath17/Gokulnaath17-Nebulous-Prism"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      Source Code
                    </a>
                    <p className="text-xs text-white/30">
                      &copy; {new Date().getFullYear()} Prism. Zero-server architecture.
                    </p>
                  </div>
                </div>
              </div>
            </motion.footer>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Prism Fidget — Easter Egg Background Switcher */}
      <motion.button
        ref={prismRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        onClick={cycleTheme}
        className="fixed bottom-6 left-6 z-50 group cursor-pointer"
        aria-label="Cycle background theme"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] backdrop-blur-xl flex items-center justify-center transition-all duration-500 group-hover:bg-white/[0.08] group-hover:border-white/20 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.06)] prism-spin">
            <Gem className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-all duration-500" strokeWidth={1.5} />
          </div>
          {/* Toast */}
          <AnimatePresence>
            {toastMsg && (
              <motion.span
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-xl text-white/70 pointer-events-none"
              >
                {toastMsg}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {scrollY > 400 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-white/10 border border-white/10 backdrop-blur-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .mask-edges {
          mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee 40s linear infinite;
          width: fit-content;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }

        .card-accent {
          position: relative;
        }
        .card-accent::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%);
          pointer-events: none;
          z-index: 0;
        }
        .card-accent > * {
          position: relative;
          z-index: 1;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }

        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.03); }
          50% { box-shadow: 0 0 40px rgba(255,255,255,0.06); }
        }
        .glow-pulse {
          animation: glow-pulse 3s ease-in-out infinite;
        }

        .stat-item {
          transition: all 0.3s ease;
        }
        .stat-item:hover {
          transform: translateY(-2px);
        }

        /* Prism fidget spin */
        .prism-spin {
          animation: prism-idle 6s ease-in-out infinite;
        }
        .group:hover .prism-spin {
          animation: prism-hover 2s ease-in-out infinite;
        }
        .group:active .prism-spin {
          animation: prism-click 0.6s ease-out;
        }
        @keyframes prism-idle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(8deg) scale(1.05); }
          75% { transform: rotate(-8deg) scale(0.95); }
        }
        @keyframes prism-hover {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
        }
        @keyframes prism-click {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(360deg) scale(1.2); }
          100% { transform: rotate(720deg) scale(1); }
        }

        /* Starfield (theme 1) */
        .stars-bg {
          background: transparent;
          overflow: hidden;
        }
        .stars-bg::before {
          content: '';
          position: absolute;
          width: 3px;
          height: 3px;
          top: 0;
          left: 0;
          box-shadow:
            7vw 8vh 0 0 rgba(255,255,255,0.4),
            23vw 15vh 0 0 rgba(255,255,255,0.3),
            42vw 5vh 0 0 rgba(255,255,255,0.5),
            58vw 22vh 0 0 rgba(255,255,255,0.2),
            73vw 12vh 0 0 rgba(255,255,255,0.35),
            88vw 28vh 0 0 rgba(255,255,255,0.25),
            15vw 35vh 0 0 rgba(255,255,255,0.45),
            35vw 45vh 0 0 rgba(255,255,255,0.15),
            55vw 55vh 0 0 rgba(255,255,255,0.4),
            75vw 65vh 0 0 rgba(255,255,255,0.2),
            90vw 75vh 0 0 rgba(255,255,255,0.3),
            10vw 85vh 0 0 rgba(255,255,255,0.5),
            30vw 92vh 0 0 rgba(255,255,255,0.25),
            50vw 78vh 0 0 rgba(255,255,255,0.35),
            70vw 88vh 0 0 rgba(255,255,255,0.15),
            85vw 95vh 0 0 rgba(255,255,255,0.4),
            3vw 50vh 0 0 rgba(255,255,255,0.3),
            20vw 60vh 0 0 rgba(255,255,255,0.2),
            40vw 70vh 0 0 rgba(255,255,255,0.45),
            60vw 40vh 0 0 rgba(255,255,255,0.25),
            80vw 50vh 0 0 rgba(255,255,255,0.35),
            95vw 60vh 0 0 rgba(255,255,255,0.15),
            5vw 18vh 0 0 rgba(255,255,255,0.4),
            45vw 30vh 0 0 rgba(255,255,255,0.2),
            65vw 8vh 0 0 rgba(255,255,255,0.5),
            28vw 25vh 0 0 rgba(255,255,255,0.3),
            38vw 48vh 0 0 rgba(255,255,255,0.35),
            68vw 72vh 0 0 rgba(255,255,255,0.25),
            82vw 42vh 0 0 rgba(255,255,255,0.4),
            12vw 95vh 0 0 rgba(255,255,255,0.2);
          animation: twinkle 4s ease-in-out infinite alternate;
        }
        .stars-bg::after {
          content: '';
          position: absolute;
          width: 1.5px;
          height: 1.5px;
          top: 0;
          left: 0;
          box-shadow:
            12vw 3vh 0 0 rgba(255,255,255,0.3),
            33vw 18vh 0 0 rgba(255,255,255,0.2),
            48vw 10vh 0 0 rgba(255,255,255,0.4),
            63vw 35vh 0 0 rgba(255,255,255,0.15),
            78vw 8vh 0 0 rgba(255,255,255,0.25),
            8vw 42vh 0 0 rgba(255,255,255,0.35),
            25vw 52vh 0 0 rgba(255,255,255,0.2),
            43vw 62vh 0 0 rgba(255,255,255,0.3),
            58vw 82vh 0 0 rgba(255,255,255,0.15),
            72vw 92vh 0 0 rgba(255,255,255,0.4),
            88vw 45vh 0 0 rgba(255,255,255,0.25),
            18vw 72vh 0 0 rgba(255,255,255,0.35),
            36vw 38vh 0 0 rgba(255,255,255,0.2),
            53vw 28vh 0 0 rgba(255,255,255,0.3),
            68vw 58vh 0 0 rgba(255,255,255,0.15),
            83vw 68vh 0 0 rgba(255,255,255,0.4),
            2vw 65vh 0 0 rgba(255,255,255,0.25),
            22vw 88vh 0 0 rgba(255,255,255,0.35),
            40vw 15vh 0 0 rgba(255,255,255,0.2),
            55vw 48vh 0 0 rgba(255,255,255,0.3);
          animation: twinkle 3s ease-in-out infinite alternate;
          animation-delay: 1.5s;
        }
        @keyframes twinkle {
          0% { opacity: 0.3; }
          100% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
          .animate-float { animation: none; }
          .glow-pulse { animation: none; }
          .prism-spin { animation: none; }
          .group:hover .prism-spin { animation: none; }
          .stars-bg::before,
          .stars-bg::after { animation: none; }
        }
      `}} />
    </main>
  );
}
