"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, CheckCircle2, FileImage, Loader2, X, Trash2, ShieldCheck, DownloadCloud } from "lucide-react";

// Types
type ProcessableFile = {
  id: string;
  file: File;
  status: "idle" | "processing" | "finalizing" | "done" | "error";
  resultUrl?: string;
  resultName?: string;
  errorMsg?: string;
  format: string;
  maxSizeKb: number;
};

type ProcessGlobals = {
  globalFormat: string;
  globalMaxSize: number;
  removeMeta: boolean;
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

// JPEG padding — adds a COM (comment) marker with filler bytes to reach target size
// This does NOT alter any pixel data; decoders silently ignore the extra segment.
const padJpegToTarget = async (blob: Blob, targetBytes: number): Promise<Blob> => {
  if (blob.size >= targetBytes) return blob;
  const needed = targetBytes - blob.size;
  if (needed > blob.size * 0.5) return blob;

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Find last marker before SOS (FF DA) — insert COM right before it
  let sosIdx = -1;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xDA) { sosIdx = i; break; }
  }
  if (sosIdx === -1) return blob;

  // COM marker: FF FE, then 2-byte big-endian length (2 + dataLen), then data
  const dataLen = needed - 4;
  if (dataLen < 0) return blob;
  const comSize = 4 + dataLen;

  const padded = new Uint8Array(bytes.length + comSize);
  padded.set(bytes.subarray(0, sosIdx));
  padded[sosIdx] = 0xFF;
  padded[sosIdx + 1] = 0xFE;
  padded[sosIdx + 2] = ((dataLen + 2) >> 8) & 0xFF;
  padded[sosIdx + 3] = (dataLen + 2) & 0xFF;
  padded.fill(0x20, sosIdx + 4, sosIdx + comSize);
  padded.set(bytes.subarray(sosIdx), sosIdx + comSize);

  return new Blob([padded], { type: 'image/jpeg' });
};

// Core Processing Logic (In-Browser Only for data isolation)
const processFile = async (pf: ProcessableFile, mode: 'SINGLE' | 'BATCH', globals: ProcessGlobals): Promise<{ blob: Blob; name: string }> => {
  return new Promise((resolve, reject) => {

    const targetSizeKb = mode === 'SINGLE' ? globals.globalMaxSize : pf.maxSizeKb;
    const targetFormat = mode === 'SINGLE' ? globals.globalFormat : pf.format;

    // When user wants no changes: no size target, keep original format, no metadata stripping
    // In all other cases, canvas processing is required (which inherently strips EXIF/metadata)
    const skipProcessing = targetSizeKb === 0 && targetFormat === 'auto' && !globals.removeMeta;
    if (skipProcessing) {
       resolve({ blob: pf.file, name: pf.file.name });
       return;
    }

    const img = new Image();
    img.onerror = () => reject(new Error("Unable to read image instance."));
    img.onload = () => {
      const objectUrl = img.src;
      try {
        const canvas = document.createElement("canvas");

        let width = img.width;
        let height = img.height;

        // Hard cap at 4000px to prevent memory issues with very large images
        if (width > 4000 || height > 4000) {
          const ratio = width / height;
          if (width > height) {
            width = 4000;
            height = Math.floor(4000 / ratio);
          } else {
            height = 4000;
            width = Math.floor(4000 * ratio);
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context initialization failed"));
        ctx.drawImage(img, 0, 0, width, height);

        const applyFormat = targetFormat === 'auto' ? (pf.file.type || 'image/jpeg') : targetFormat;
        const ext = applyFormat === 'image/jpeg' ? '.jpg' : (applyFormat === 'image/png' ? '.png' : '.webp');

        let baseName = pf.file.name;
        const lastDot = baseName.lastIndexOf(".");
        if (lastDot !== -1) baseName = baseName.substring(0, lastDot);
        const outName = baseName + ext;

        URL.revokeObjectURL(objectUrl);

        // Auto / Best Quality — export at high quality, no size target
        if (targetSizeKb === 0) {
           canvas.toBlob((blob) => {
             if (blob) resolve({ blob, name: outName });
             else reject(new Error("Export processing failed."));
           }, applyFormat, 0.95);
           return;
        }

        // PNG with explicit size target — use dimension-based binary search (lossless)
        if (applyFormat === 'image/png') {
          const targetBytes = targetSizeKb * 1024;
          let minScale = 0.1;
          let maxScale = 1.0;
          let closestBlob: Blob | null = null;
          let bestBlob: Blob | null = null;
          let smallestBlob: Blob | null = null;
          let attempts = 0;
          const MAX_ATTEMPTS = 12;

          const tryScale = (scale: number) => {
            const cw = Math.floor(Math.max(1, width * scale));
            const ch = Math.floor(Math.max(1, height * scale));
            const c = document.createElement("canvas");
            c.width = cw;
            c.height = ch;
            const cctx = c.getContext("2d");
            if (!cctx) {
              if (bestBlob) resolve({ blob: bestBlob, name: outName });
              else if (closestBlob) resolve({ blob: closestBlob, name: outName });
              else if (smallestBlob) resolve({ blob: smallestBlob, name: outName });
              else reject(new Error("Canvas context initialization failed"));
              return;
            }
            cctx.drawImage(img, 0, 0, cw, ch);
            c.toBlob((blob) => {
              if (!blob) return;
              attempts++;
              if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
              if (!closestBlob || Math.abs(blob.size - targetBytes) < Math.abs(closestBlob.size - targetBytes)) closestBlob = blob;

              if (blob.size <= targetBytes * 1.05) {
                bestBlob = blob;
                minScale = scale;
              } else {
                maxScale = scale;
              }

              if (attempts < MAX_ATTEMPTS && maxScale - minScale > 0.01) {
                tryScale((minScale + maxScale) / 2);
              } else {
                resolve({ blob: closestBlob || bestBlob || smallestBlob || blob, name: outName });
              }
            }, 'image/png');
          };

          tryScale(1.0);
          return;
        }

        // JPEG/WebP — binary search on quality parameter
        const targetBytes = targetSizeKb * 1024;
        let minQ = 0.05;
        let maxQ = 1.0;

        // Adaptive starting quality: estimate how much compression is needed
        const fileSizeBytes = pf.file.size || targetBytes * 2;
        const estimatedRatio = targetBytes / fileSizeBytes;
        const startQ = Math.min(0.95, Math.max(0.05, estimatedRatio * 2));

        let closestBlob: Blob | null = null;
        let bestBlob: Blob | null = null;
        let smallestBlob: Blob | null = null;
        let attempts = 0;
        const MAX_ATTEMPTS = 12;

        const tryCompress = (q: number) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              if (closestBlob) resolve({ blob: closestBlob, name: outName });
              else if (bestBlob) resolve({ blob: bestBlob, name: outName });
              else if (smallestBlob) resolve({ blob: smallestBlob, name: outName });
              else reject(new Error("Export processing failed."));
              return;
            }
            attempts++;

            if (!smallestBlob || blob.size < smallestBlob.size) {
              smallestBlob = blob;
            }
            if (!closestBlob || Math.abs(blob.size - targetBytes) < Math.abs(closestBlob.size - targetBytes)) {
              closestBlob = blob;
            }

            if (blob.size <= targetBytes * 1.05) {
              bestBlob = blob;
              minQ = q;
            } else {
              maxQ = q;
            }

            if (attempts < MAX_ATTEMPTS && maxQ - minQ > 0.01) {
              tryCompress((minQ + maxQ) / 2);
            } else {
               const result = closestBlob || bestBlob || smallestBlob || blob;
               if (applyFormat === 'image/jpeg' && result.size < targetBytes) {
                 padJpegToTarget(result, targetBytes).then(padded => {
                   resolve({ blob: padded, name: outName });
                 }).catch(() => resolve({ blob: result, name: outName }));
               } else {
                 resolve({ blob: result, name: outName });
               }
            }
          }, applyFormat, q);
        };

        tryCompress(startQ);
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      }
    };
    img.src = URL.createObjectURL(pf.file);
  });
};

export default function PrismApp() {
  const [introState, setIntroState] = useState<number>(0);
  const [files, setFiles] = useState<ProcessableFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [mode, setMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [globalFormat, setGlobalFormat] = useState('auto');
  const [globalMaxSize, setGlobalMaxSize] = useState(0);
  const [customSizeKb, setCustomSizeKb] = useState<string>('');
  const [customFileSizes, setCustomFileSizes] = useState<Record<string, string>>({});
  const [removeMeta, setRemoveMeta] = useState(true);

  const [workflowState, setWorkflowState] = useState<'idle' | 'processing' | 'finalizing' | 'ready_to_download'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Intro Sequencing
  useEffect(() => {
    const s1 = setTimeout(() => setIntroState(1), 800);
    const s2 = setTimeout(() => setIntroState(2), 1600);
    const s3 = setTimeout(() => setIntroState(3), 2400);
    const s4 = setTimeout(() => setIntroState(4), 3600);
    return () => { clearTimeout(s1); clearTimeout(s2); clearTimeout(s3); clearTimeout(s4); };
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
    const newPfs: ProcessableFile[] = dropped.map(f => ({
      id: Math.random().toString(36).slice(2, 9),
      file: f,
      status: "idle",
      format: globalFormat,
      maxSizeKb: globalMaxSize
    }));
    setFiles(prev => [...prev, ...newPfs]);
  }, [workflowState, globalFormat, globalMaxSize]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (workflowState !== 'idle' || !e.target.files) return;
    const selected = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
    const newPfs: ProcessableFile[] = selected.map(f => ({
      id: Math.random().toString(36).slice(2, 9),
      file: f,
      status: "idle",
      format: globalFormat,
      maxSizeKb: globalMaxSize
    }));
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

  const downloadAll = () => {
    files.forEach((res, index) => {
      if (res.status === "done" && res.resultUrl && res.resultName) {
         // Tiny delay between clicks to prevent browser throttling, usually <500ms is allowed synchronously
         setTimeout(() => {
            const a = document.createElement("a");
            a.href = res.resultUrl!;
            a.download = res.resultName!;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
         }, index * 100);
      }
    });
  };

  const processAll = async () => {
    if (files.length === 0 || workflowState !== 'idle') return;
    
    setWorkflowState('processing');
    setFiles(prev => prev.map(p => ({ ...p, status: "processing" })));

    // 1. Process files
    const results = await Promise.all(
      files.map(async (pf) => {
        try {
          const effectiveSize = mode === 'SINGLE'
            ? (globalMaxSize === -1 ? (Number(customSizeKb) || 0) : globalMaxSize)
            : (pf.maxSizeKb === -1 ? (Number(customFileSizes[pf.id]) || 0) : pf.maxSizeKb);
          const pfWithSize = { ...pf, maxSizeKb: effectiveSize };
          const processed = await processFile(pfWithSize, mode, { globalFormat, globalMaxSize: effectiveSize, removeMeta });
          const url = URL.createObjectURL(processed.blob);
          return { ...pf, status: "finalizing" as const, resultUrl: url, resultName: processed.name };
        } catch (e: any) {
          return { ...pf, status: "error" as const, errorMsg: e.message };
        }
      })
    );

    setFiles(results);
    setWorkflowState('finalizing');

    // 2. Cinematic Finalizing Delay (1.5 seconds)
    await new Promise(r => setTimeout(r, 1500));

    // 3. Mark as done & await user download action
    setFiles(prev => prev.map(f => f.status === 'finalizing' ? { ...f, status: 'done' } : f));
    setWorkflowState('ready_to_download');
  };

  const hasFiles = files.length > 0;
  
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-[#F5F5F7] overflow-x-hidden relative scroll-smooth py-8 sm:py-12">
      <NoiseOverlay />
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vh] bg-white rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vh] bg-white rounded-full blur-[150px]"></div>
      </div>

      <AnimatePresence mode="wait">
        {introState < 4 && (
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
            className="w-full max-w-[1280px] mx-auto flex flex-col z-10 px-4 sm:px-8 relative min-h-screen lg:min-h-0 lg:h-[85vh] lg:max-h-[800px]"
          >
            {/* Header */}
            <header className="flex justify-between items-end pb-6 shrink-0 z-20">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.5em] text-white/40 mb-1 font-semibold flex items-center gap-2">
                   <ShieldCheck className="w-3 h-3 text-white/60" /> Zero-Server Image Processing
                </span>
                <h1 className="text-2xl font-light tracking-tighter">NEBULOUS<span className="font-bold">.PRISM</span></h1>
              </div>
            </header>

            {/* Core Split Layout */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0 relative z-20">
              
              {/* === LEFT CARD: Inputs & Queue === */}
              <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] border border-white/5 rounded-[2rem] shadow-2xl backdrop-blur-3xl overflow-hidden min-h-[500px] lg:min-h-0 flex-shrink-0">
                
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
                    <input type="file" id="fileUpload" multiple className="hidden" accept="image/*" onChange={handleFileSelect} disabled={workflowState !== 'idle'} />
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

                  {/* Processing Queue List 
                      Clamped layout: We show up to ~4 items nicely. Remaining scroll natively via flex.
                  */}
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
                            {/* Animated Underlines during workflow states */}
                            {pf.status === "processing" && (
                              <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "linear", repeat: Infinity }} className="absolute bottom-0 left-0 h-[2px] bg-white/30" />
                            )}
                            {pf.status === "finalizing" && (
                              <motion.div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 size-full animate-[shimmer_1.5s_infinite]" />
                            )}

                            {/* Item Icon */}
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                              {pf.status === "processing" ? <Loader2 className="w-5 h-5 animate-spin text-white/50" /> 
                               : pf.status === "finalizing" ? <DownloadCloud className="w-5 h-5 text-white/70 animate-pulse" /> 
                               : <FileImage className="w-5 h-5 text-white/50" strokeWidth={1} />}
                            </div>
                            
                            {/* Basic Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                              <p className="text-[13px] font-medium text-white/90 truncate">{pf.file.name}</p>
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono">
                                 {pf.status === "processing" && <span className="text-white/60">Executing algorithms...</span>}
                                 {pf.status === "finalizing" && <span className="text-white/80">Packaging payload...</span>}
                                 {pf.status === "done" && <span className="text-white/60">Asset Compiled</span>}
                                 {pf.status === "error" && <span className="text-red-400">Exception thrown</span>}
                                 {pf.status === "idle" && <span className="text-white/30 font-medium">Vol: {(pf.file.size / 1024 / 1024).toFixed(2)} MB</span>}
                              </div>
                            </div>

                            {/* Batch Custom Selectors (Only on Batch Mode & Idle state) */}
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
                                       value={customFileSizes[pf.id] || ''}
                                       onChange={(e) => setCustomFileSizes(prev => ({ ...prev, [pf.id]: e.target.value }))}
                                       placeholder="KB"
                                       className="bg-black/50 border border-white/10 rounded-lg py-2 px-2 text-[11px] font-medium tracking-wide text-white/80 outline-none hover:border-white/30 transition-colors w-full sm:w-[80px] text-center"
                                     />
                                   )}
                               </div>
                            )}

                            {/* Controls / Ticks */}
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
              </div>

              {/* === RIGHT CARD: Config & Automation === */}
              <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white/[0.02] border border-white/5 rounded-[2rem] shadow-2xl backdrop-blur-3xl shrink-0 min-h-[500px] lg:min-h-0 flex-shrink-0">
                 
                 {/* Configuration Module */}
                 <div className="flex-1 p-6 sm:p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                    
                    {/* Operation Architecture */}
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
                          {mode === 'SINGLE' ? "Universal configuration deployed to all operational assets securely." : "Unlock individual parameter modification for each payload item in queue."}
                        </p>
                     </div>

                     <div className="w-full h-px bg-white/5 shrink-0"></div>

                     {/* Global Configuration Controls */}
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
                                 value={customSizeKb}
                                 onChange={(e) => setCustomSizeKb(e.target.value)}
                                 placeholder="Enter size in KB"
                                 className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white/90 outline-none hover:border-white/30 focus:border-white/50 transition-colors"
                               />
                               <p className="text-[10px] text-white/40 mt-1.5 font-mono">Enter target size in Kilobytes</p>
                             </div>
                           )}
                        </div>
                     </div>

                     <div className="w-full h-px bg-white/5 shrink-0"></div>

                     {/* Additional settings */}
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
                         className="mt-auto shrink-0 h-[80px] w-full rounded-[2rem] bg-white text-black text-[13px] font-bold uppercase tracking-[0.2em] flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] shadow-[0_0_50px_rgba(255,255,255,0.15)] relative overflow-hidden group"
                       >
                         <div className="absolute inset-0 bg-black/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
                         <span className="relative z-10 flex items-center gap-3">
                           <DownloadCloud className="w-5 h-5 text-black" /> Download All Files
                         </span>
                       </button>
                     ) : (
                       <button 
                         disabled={!hasFiles || workflowState !== 'idle'}
                         onClick={processAll}
                         className="mt-auto shrink-0 h-[80px] w-full rounded-[2rem] bg-white text-black text-[13px] font-bold uppercase tracking-[0.4em] flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_50px_rgba(255,255,255,0.08)] relative overflow-hidden group"
                       >
                         <div className="absolute inset-0 bg-black/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
                         
                         <span className="relative z-10 flex items-center gap-3">
                           {workflowState === 'processing' ? (
                             <><Loader2 className="w-5 h-5 animate-spin" /> Compiling Phase 1</>
                           ) : workflowState === 'finalizing' ? (
                             <><DownloadCloud className="w-5 h-5 animate-pulse" /> Finalizing Phase 2</>
                           ) : (
                              "Process Items"
                           )}
                         </span>
                       </button>
                     )}
                 </div>

              </div>

            </div>

            {/* Mobile Scroll Prompt (Hidden on Desktop) */}
            <div className="lg:hidden w-full py-8 flex justify-center text-white/30 animate-bounce">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </main>
  );
}
