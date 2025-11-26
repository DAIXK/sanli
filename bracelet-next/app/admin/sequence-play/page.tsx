'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BraceletAssemblyPage from '../bracelet-assembly/page';
import ModelViewerPage from '../gltf-viewer/page';

const DIY_MODEL_CACHE_KEY = 'bracelet_diy_model_cache';

const dataUrlToBlob = (dataUrl: string, fallbackType = 'application/octet-stream') => {
  if (!dataUrl || typeof dataUrl !== 'string') return new Blob([], { type: fallbackType });
  const [meta, base64 = ''] = dataUrl.split(',');
  const mimeMatch = /^data:(.*?);/.exec(meta || '');
  const mime = mimeMatch?.[1] || fallbackType;
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes.buffer], { type: mime });
  } catch (error) {
    console.warn('Failed to decode cached diy model', error);
    return new Blob([], { type: fallbackType });
  }
};

const SequencePlayPage = () => {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<'assembly' | 'viewer'>('assembly');
  const [cachedDiyUrl, setCachedDiyUrl] = useState<string | undefined>(undefined);
  const cachedUrlRef = useRef<string | null>(null);

  const handleAssemblyFinished = useCallback(() => {
    setStage('viewer');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const raw = window.localStorage?.getItem(DIY_MODEL_CACHE_KEY);
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        if (payload?.dataUrl) {
          const blob = dataUrlToBlob(payload.dataUrl, payload.type || 'model/gltf-binary');
          if (blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            cachedUrlRef.current = objectUrl;
            setCachedDiyUrl(objectUrl);
          }
        }
      } catch (error) {
        console.warn('Failed to restore cached diy model', error);
      }
    }
    return () => {
      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
      }
    };
  }, []);

  const config = useMemo(() => {
    const decodeOrRaw = (value: string | null) => {
      if (!value) return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const diy = decodeOrRaw(searchParams?.get('diyModel')) || decodeOrRaw(searchParams?.get('diy'));
    const assemblyDiy = decodeOrRaw(searchParams?.get('assemblyModel')) || diy;
    const viewerBase = decodeOrRaw(searchParams?.get('viewerModel')) || undefined;
    const assemblyBg = decodeOrRaw(searchParams?.get('assemblyBg')) || decodeOrRaw(searchParams?.get('bg'));
    const viewerBg = decodeOrRaw(searchParams?.get('viewerBg')) || decodeOrRaw(searchParams?.get('bg'));

    return {
      assemblyDiy: assemblyDiy || undefined,
      viewerBase: viewerBase || undefined,
      diy: diy || undefined,
      assemblyBg: assemblyBg || undefined,
      viewerBg: viewerBg || undefined,
    };
  }, [searchParams]);

  const assemblyDiyUrl = cachedDiyUrl || config.assemblyDiy;
  const viewerDiyUrl = cachedDiyUrl || config.diy;
  const label = stage === 'assembly' ? '组装展示中...' : '佩戴展示中...';

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        touchAction: 'none',
        overscrollBehavior: 'none',
        background: '#000',
        inset: 0,
      }}
    >
      {stage === 'assembly' ? (
        <BraceletAssemblyPage
          onFinished={handleAssemblyFinished}
          diyModelUrl={assemblyDiyUrl}
          backgroundUrl={config.assemblyBg}
        />
      ) : (
        <ModelViewerPage
          baseModelUrl={config.viewerBase}
          diyModelUrl={viewerDiyUrl}
          backgroundUrl={config.viewerBg}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 20,
          background: 'rgba(0,0,0,0.55)',
          color: 'white',
          padding: '8px 10px',
          borderRadius: '6px',
          fontSize: '12px',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default SequencePlayPage;
