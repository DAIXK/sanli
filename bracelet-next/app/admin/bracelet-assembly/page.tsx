'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type AnimatedBead = {
  object: THREE.Object3D;
  startTime: number;
  duration: number;
  spawnPos: THREE.Vector3;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startAngle: number;
  targetAngle: number;
  angleDelta: number;
  startQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  arcHeight: number;
};

const DEFAULT_DIY_MODEL = '/static/diy.gltf';
const DEFAULT_RING_RADIUS = 0.065; // meters (6.5 cm)
const DEFAULT_HEIGHT = 0.02;
const DEFAULT_BRACELET_SCALE = 1;
const DEFAULT_BRACELET_OFFSET: [number, number, number] = [0, 0, 0];

const BraceletAssemblyPage = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ringBasisRef = useRef<{
    center: THREE.Vector3;
    normal: THREE.Vector3;
    topDir: THREE.Vector3;
    sideDir: THREE.Vector3;
    radius: number;
  }>({
    center: new THREE.Vector3(0, DEFAULT_HEIGHT, 0),
    normal: new THREE.Vector3(0, 1, 0),
    topDir: new THREE.Vector3(0, 0, 1),
    sideDir: new THREE.Vector3(1, 0, 0),
    radius: DEFAULT_RING_RADIUS,
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const beadAnimationsRef = useRef<AnimatedBead[]>([]);
  const searchParams = useSearchParams();

  const { diyModelUrl, braceletScale, braceletOffset } = useMemo(() => {
    const parseNumber = (v: string | null, fallback: number) => {
      if (v === null || v === undefined) return fallback;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const raw = searchParams?.get('diyModel') || searchParams?.get('diy');
    let url = DEFAULT_DIY_MODEL;
    if (raw) {
      try {
        url = decodeURIComponent(raw);
      } catch {
        url = raw;
      }
    }

    const scale = parseNumber(searchParams?.get('scale'), DEFAULT_BRACELET_SCALE);
    const offsetX = parseNumber(searchParams?.get('offsetX'), DEFAULT_BRACELET_OFFSET[0]);
    const offsetY = parseNumber(searchParams?.get('offsetY'), DEFAULT_BRACELET_OFFSET[1]);
    const offsetZ = parseNumber(searchParams?.get('offsetZ'), DEFAULT_BRACELET_OFFSET[2]);

    return {
      diyModelUrl: url,
      braceletScale: scale,
      braceletOffset: new THREE.Vector3(offsetX, offsetY, offsetZ),
    };
  }, [searchParams]);

  useEffect(() => {
    if (!mountRef.current) return;

    setLoadingError(null);
    setLoadingProgress(0);
    beadAnimationsRef.current = [];

    let disposed = false;
    let animationId = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d0f);

    const camera = new THREE.PerspectiveCamera(
      55,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.01,
      10
    );
    camera.position.set(0.12, 0.06, 0.2);
    camera.lookAt(0, DEFAULT_HEIGHT, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    mountRef.current.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(1, 1, 1);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.8);
    rim.position.set(-1, 0.6, -0.6);
    scene.add(rim);

    const loader = new GLTFLoader();
    const clock = new THREE.Clock();

    const collectBeads = (root: THREE.Object3D) => {
      type BeadSource = {
        obj: THREE.Object3D;
        extras: any;
        targetPos: THREE.Vector3;
        targetQuat: THREE.Quaternion;
        targetScale: THREE.Vector3;
      };

      const sources: BeadSource[] = [];
      const center = new THREE.Vector3();

      root.traverse((obj) => {
        const extras = (obj as any).userData || {};
        if (!extras || !extras.isMarbleRoot) return;
        const targetPos = obj.getWorldPosition(new THREE.Vector3());
        const targetQuat = obj.getWorldQuaternion(new THREE.Quaternion());
        const targetScale = obj.getWorldScale(new THREE.Vector3());
        center.add(targetPos);
        sources.push({ obj, extras, targetPos, targetQuat, targetScale });
      });

      if (!sources.length) {
        beadAnimationsRef.current = [];
        return;
      }

      center.divideScalar(sources.length);

      // 估计环的法线
      const normal = new THREE.Vector3();
      for (let i = 0; i < sources.length; i += 1) {
        const a = sources[i].targetPos.clone().sub(center);
        const b = sources[(i + 1) % sources.length].targetPos.clone().sub(center);
        normal.add(a.cross(b));
      }
      if (normal.lengthSq() < 1e-6) {
        normal.set(0, 1, 0);
      } else {
        normal.normalize();
      }

      // 选择“顶点方向”（圆环上的起点）：将世界 up 投影到环平面
      const worldUp = new THREE.Vector3(0, 1, 0);
      const topDir = worldUp.clone().sub(normal.clone().multiplyScalar(worldUp.dot(normal)));
      if (topDir.lengthSq() < 1e-6) {
        // 如果正好垂直，退化用第一颗珠子方向
        topDir.copy(sources[0].targetPos.clone().sub(center));
      }
      if (topDir.lengthSq() < 1e-6) {
        topDir.set(0, 0, 1);
      }
      topDir.normalize();
      const sideDir = new THREE.Vector3().crossVectors(normal, topDir).normalize();

      // 半径和角度
      let radiusSum = 0;
      let radiusCount = 0;
      sources.forEach((s) => {
        const v = s.targetPos.clone().sub(center);
        const len = v.length();
        if (len > 0) {
          radiusSum += len;
          radiusCount += 1;
        }
      });
      const ringRadius = radiusCount > 0 ? radiusSum / radiusCount : DEFAULT_RING_RADIUS;

      ringBasisRef.current = {
        center,
        normal,
        topDir,
        sideDir,
        radius: ringRadius,
      };

      // Sort by arcStart/currentAngle to place beads around the ring in order.
      sources.sort((a, b) => {
        const aVec = a.targetPos.clone().sub(center);
        const bVec = b.targetPos.clone().sub(center);
        const aAngleRaw = Math.atan2(aVec.dot(sideDir), aVec.dot(topDir));
        const bAngleRaw = Math.atan2(bVec.dot(sideDir), bVec.dot(topDir));
        const aAngle = a.extras?.arcStart ?? a.extras?.currentAngle ?? aAngleRaw;
        const bAngle = b.extras?.arcStart ?? b.extras?.currentAngle ?? bAngleRaw;
        return aAngle - bAngle;
      });
      // 反向排列，让叠加从左侧开始（与当前环的方向相反）
      sources.reverse();

      const beads: AnimatedBead[] = [];
      const startAngle = 0.1; // 顶点作为初始参考，所有珠子同一起点
      const spawnPos = topDir
        .clone()
        .multiplyScalar(Math.cos(startAngle) * ringRadius)
        .add(sideDir.clone().multiplyScalar(Math.sin(startAngle) * ringRadius))
        .add(center)
        .add(normal.clone().multiplyScalar(0.01)); // 固定出现点，略微抬高
      const twoPi = Math.PI * 2;
      const baseStart = clock.getElapsedTime();
      const perBeadDelay = 0.35; // 放慢节奏
      const flightDuration = 1.6; // 每颗滑动更慢
      const arcHeightBase = 0; // 轨迹紧贴圆圈平面，不抬高

      sources.forEach((source, index) => {
        const vec = source.targetPos.clone().sub(center);
        let targetAngle = Math.atan2(vec.dot(sideDir), vec.dot(topDir));
        // 展开角度，保证从统一起点按正向行进
        while (targetAngle < startAngle - 1e-6) targetAngle += twoPi;
        const angleDelta = targetAngle - startAngle;

        const targetPos = topDir
          .clone()
          .multiplyScalar(Math.cos(targetAngle) * ringRadius)
          .add(sideDir.clone().multiplyScalar(Math.sin(targetAngle) * ringRadius))
          .add(center);
        const startPos = spawnPos.clone();
        const beadClone = source.obj.clone(true);
        beadClone.position.copy(spawnPos); // 初始显示在固定位置
        beadClone.quaternion.copy(source.targetQuat);
        beadClone.scale.copy(source.targetScale);
        beadClone.visible = false;
        scene.add(beadClone);

        const bounds = source.extras?.bounds as { diameter?: number } | undefined;
        const arcHeight = arcHeightBase; // 可以按需改成 bounds.diameter 调整抬升

        beads.push({
          object: beadClone,
          startTime: baseStart + index * perBeadDelay,
          duration: flightDuration,
          spawnPos: spawnPos.clone(),
          startPos,
          targetPos,
          startAngle,
          targetAngle,
          angleDelta,
          startQuat: source.targetQuat.clone(),
          targetQuat: source.targetQuat.clone(),
          arcHeight,
        });

        // Hide original bead
        source.obj.visible = false;
      });

      beadAnimationsRef.current = beads;
    };

    loader.load(
      diyModelUrl,
      (gltf) => {
        if (disposed) return;
        const diyRoot = gltf.scene;
        diyRoot.position.set(
          braceletOffset.x,
          DEFAULT_HEIGHT + braceletOffset.y,
          braceletOffset.z
        );
        diyRoot.rotation.set(0, 0, 0);
        diyRoot.scale.set(braceletScale, braceletScale, braceletScale);
        scene.add(diyRoot);

        diyRoot.updateMatrixWorld(true);
        collectBeads(diyRoot);
        setLoadingProgress(100);
      },
      (xhr) => {
        if (disposed) return;
        const total = xhr.total || 1;
        setLoadingProgress((xhr.loaded / total) * 100);
      },
      (error) => {
        console.error('Failed to load diy model', error);
        if (!disposed) setLoadingError(`Failed to load diy model: ${diyModelUrl}`);
      }
    );

    const animate = () => {
      if (disposed) return;
      animationId = requestAnimationFrame(animate);
      const now = clock.getElapsedTime();

      if (beadAnimationsRef.current.length) {
        const { center, normal, topDir, sideDir, radius } = ringBasisRef.current;
        beadAnimationsRef.current.forEach((item) => {
          const t = (now - item.startTime) / item.duration;
          if (t <= 0) {
            item.object.visible = true;
            item.object.position.copy(item.spawnPos);
            item.object.quaternion.copy(item.startQuat);
            return;
          }
          const clamped = Math.min(1, t);
          const eased = clamped * clamped * (3 - 2 * clamped);
          item.object.visible = true;
          // 从起点沿顺序走到各自目标，距离为 angleDelta
          const angle = item.startAngle + item.angleDelta * eased;
          const pos = topDir
            .clone()
            .multiplyScalar(Math.cos(angle) * radius)
            .add(sideDir.clone().multiplyScalar(Math.sin(angle) * radius))
            .add(center);
          // 不叠加高度，轨迹贴合圈所在平面
          item.object.position.copy(pos);
          item.object.quaternion.slerpQuaternions(item.startQuat, item.targetQuat, eased);
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      pmremGenerator.dispose();
      envMap.dispose?.();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      beadAnimationsRef.current = [];
    };
  }, [diyModelUrl, braceletScale, braceletOffset]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          background: 'rgba(0,0,0,0.55)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          lineHeight: '16px',
        }}
      >
        <div>手串装配动画（无手模）</div>
        {loadingProgress < 100 && <div>Loading: {Math.round(loadingProgress)}%</div>}
        {loadingError && <div style={{ color: 'red' }}>{loadingError}</div>}
      </div>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default BraceletAssemblyPage;
