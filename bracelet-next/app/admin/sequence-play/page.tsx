'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BraceletAssemblyPage from '../bracelet-assembly/page';
import ModelViewerPage from '../gltf-viewer/page';

const SequencePlayPage = () => {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<'assembly' | 'viewer'>('assembly');

  const handleAssemblyFinished = useCallback(() => {
    setStage('viewer');
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
          diyModelUrl={config.assemblyDiy}
          backgroundUrl={config.assemblyBg}
        />
      ) : (
        <ModelViewerPage
          baseModelUrl={config.viewerBase}
          diyModelUrl={config.diy}
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
