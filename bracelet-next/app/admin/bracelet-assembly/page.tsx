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
  baseScale: THREE.Vector3;
};

const DEFAULT_DIY_MODEL = '/static/diy.gltf';
const DEFAULT_RING_RADIUS = 0.165; // meters (6.5 cm)
const DEFAULT_HEIGHT = 0.02;
const DEFAULT_BRACELET_SCALE = 1.85;
const DEFAULT_CAM_RADIUS = 0.28;
const DEFAULT_CAM_YAW = 0; // 0 -> 面向 +Z
const DEFAULT_CAM_PITCH = 0; // 抬头角度（弧度）
const DEFAULT_BRACELET_OFFSET: [number, number, number] = [0, 0, 0];
const DEFAULT_PER_BEAD_DELAY = 0.18; // 每颗珠子出现的时间间隔（秒）
const DEFAULT_FLIGHT_DURATION = 0.15; // 单颗珠子滑动到位所需时间（秒）
const DETAIL_SCALE = 2; // 放大倍数
const DETAIL_RADIUS_BOOST = 0; // 细节模式半径额外放大比例（保持为 0 让珠子与绳子对齐）
const DETAIL_CAM_RADIUS = 0.18; // 细节视角相机距离
const DETAIL_CAM_PITCH = 0; // 细节阶段保持正面角度
const DETAIL_TARGET_LIFT = 0.2; // 沿法线微抬镜头目标
const DETAIL_TOP_LIFT = 3.2; // 沿 topDir 提升视点，突出顶部珠子
const DETAIL_DELAY = 0.3; // 完成后停顿
const DETAIL_ZOOM_IN = 0.6;
const DETAIL_HOLD = 3.8;
const DETAIL_ZOOM_OUT = 0.6;
const DETAIL_RADIUS_GAP_FACTOR = 2; // 细节模式下基于珠子直径额外腾出的比例

const BraceletAssemblyPage = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const braceletGroupRef = useRef<THREE.Group | null>(null);
  const ringBasisRef = useRef<{
    center: THREE.Vector3;
    normal: THREE.Vector3;
    topDir: THREE.Vector3;
    sideDir: THREE.Vector3;
    radius: number;
    avgDiameter: number;
  }>({
    center: new THREE.Vector3(0, DEFAULT_HEIGHT, 0),
    normal: new THREE.Vector3(0, 1, 0),
    topDir: new THREE.Vector3(0, 0, 1),
    sideDir: new THREE.Vector3(1, 0, 0),
    radius: DEFAULT_RING_RADIUS,
    avgDiameter: DEFAULT_RING_RADIUS * 0.02,
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const beadAnimationsRef = useRef<AnimatedBead[]>([]);
  const sequenceEndRef = useRef(0);
  const detailPhaseRef = useRef<'idle' | 'zoomIn' | 'hold' | 'zoomOut' | 'done'>('idle');
  const detailPhaseStartRef = useRef(0);
  const detailProgressRef = useRef(0);
  const searchParams = useSearchParams();

  const { diyModelUrl, braceletScale, braceletOffset, camRadius, camYaw, camPitch } = useMemo(() => {
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
    const camR = parseNumber(searchParams?.get('camR'), DEFAULT_CAM_RADIUS);
    const camYawVal = parseNumber(searchParams?.get('camYaw'), DEFAULT_CAM_YAW);
    const camPitchVal = parseNumber(searchParams?.get('camPitch'), DEFAULT_CAM_PITCH);

    return {
      diyModelUrl: url,
      braceletScale: scale,
      braceletOffset: new THREE.Vector3(offsetX, offsetY, offsetZ),
      camRadius: camR,
      camYaw: camYawVal,
      camPitch: camPitchVal,
    };
  }, [searchParams]);

  useEffect(() => {
    if (!mountRef.current) return;

    setLoadingError(null);
    setLoadingProgress(0);
    beadAnimationsRef.current = [];
    sequenceEndRef.current = 0;
    detailPhaseRef.current = 'idle';
    detailPhaseStartRef.current = 0;

    let disposed = false;
    let animationId = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d0f);

    const braceletGroup = new THREE.Group();
    scene.add(braceletGroup);
    braceletGroupRef.current = braceletGroup;

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
    const applyCamera = (detailFactor: number) => {
      const { center, radius, topDir, normal } = ringBasisRef.current;
      const baseR = camRadius || radius * 3;
      const baseYaw = camYaw;
      const basePitch = camPitch;
      const targetR = DETAIL_CAM_RADIUS || baseR * 0.6;
      const targetYaw = baseYaw;
      const targetPitch = DETAIL_CAM_PITCH;
      const r = THREE.MathUtils.lerp(baseR, targetR, detailFactor);
      const yaw = THREE.MathUtils.lerp(baseYaw, targetYaw, detailFactor);
      const pitch = THREE.MathUtils.lerp(basePitch, targetPitch, detailFactor);
      const horizontal = r * Math.cos(pitch);
      const target = center
        .clone()
        .add(normal.clone().multiplyScalar(detailFactor * radius * DETAIL_TARGET_LIFT))
        .add(topDir.clone().multiplyScalar(detailFactor * radius * DETAIL_TOP_LIFT));
      const pos = new THREE.Vector3(
        target.x + horizontal * Math.sin(yaw),
        target.y + r * Math.sin(pitch),
        target.z + horizontal * Math.cos(yaw)
      );
      camera.position.copy(pos);
      camera.lookAt(target);
    };

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
      let diameterSum = 0;
      let diameterCount = 0;

      root.traverse((obj) => {
        const extras = (obj as any).userData || {};
        if (!extras || !extras.isMarbleRoot) return;
        const targetPos = obj.getWorldPosition(new THREE.Vector3());
        const targetQuat = obj.getWorldQuaternion(new THREE.Quaternion());
        const targetScale = obj.getWorldScale(new THREE.Vector3());
        center.add(targetPos);
        const bounds = extras.bounds as { diameter?: number } | undefined;
        if (bounds?.diameter) {
          diameterSum += bounds.diameter;
          diameterCount += 1;
        }
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
      const avgDiameter =
        diameterCount > 0 ? diameterSum / diameterCount : Math.max(0.0005, ringRadius * 0.02);

      ringBasisRef.current = {
        center,
        normal,
        topDir,
        sideDir,
        radius: ringRadius,
        avgDiameter,
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
      const perBeadDelay = DEFAULT_PER_BEAD_DELAY;
      const flightDuration = DEFAULT_FLIGHT_DURATION;
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
        braceletGroup.add(beadClone);

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
          baseScale: source.targetScale.clone(),
        });

        // Hide original bead
        source.obj.visible = false;
      });

      beadAnimationsRef.current = beads;
      sequenceEndRef.current =
        beads.length > 0 ? baseStart + (beads.length - 1) * perBeadDelay + flightDuration : 0;
      detailPhaseRef.current = 'idle';
      detailPhaseStartRef.current = 0;
      applyCamera(0);
      detailProgressRef.current = 0;
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
        braceletGroup.add(diyRoot);

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

      // 细节阶段管理
      let detailFactor = 0;
      if (sequenceEndRef.current > 0) {
        const phase = detailPhaseRef.current;
        if (phase === 'idle' && now >= sequenceEndRef.current + DETAIL_DELAY) {
          detailPhaseRef.current = 'zoomIn';
          detailPhaseStartRef.current = now;
        }
        if (detailPhaseRef.current === 'zoomIn') {
          const p = Math.min(1, (now - detailPhaseStartRef.current) / DETAIL_ZOOM_IN);
          detailFactor = p;
          if (p >= 1) {
            detailPhaseRef.current = 'hold';
            detailPhaseStartRef.current = now;
          }
        } else if (detailPhaseRef.current === 'hold') {
          detailFactor = 1;
          if (now - detailPhaseStartRef.current >= DETAIL_HOLD) {
            detailPhaseRef.current = 'zoomOut';
            detailPhaseStartRef.current = now;
          }
        } else if (detailPhaseRef.current === 'zoomOut') {
          const p = Math.min(1, (now - detailPhaseStartRef.current) / DETAIL_ZOOM_OUT);
          detailFactor = 1 - p;
          if (p >= 1) {
            detailPhaseRef.current = 'done';
          }
        } else if (detailPhaseRef.current === 'done') {
          detailFactor = 0;
        }
      }

      // 应用整体缩放（包含细节放大 + 间隙带来的环增大）
      const { radius, avgDiameter } = ringBasisRef.current;
      const gapDelta = detailFactor * ((DETAIL_RADIUS_GAP_FACTOR * (avgDiameter || 0)) / Math.max(radius, 1e-6));
      const detailScale = 1 + detailFactor * (DETAIL_SCALE - 1);
      const groupScale = detailScale * (1 + gapDelta);
      if (braceletGroupRef.current) {
        braceletGroupRef.current.scale.setScalar(groupScale);
      }
      detailProgressRef.current = detailFactor;

      if (beadAnimationsRef.current.length) {
        const { center, normal, topDir, sideDir, radius } = ringBasisRef.current;
        beadAnimationsRef.current.forEach((item) => {
          const t = (now - item.startTime) / item.duration;
          if (t <= 0) {
            // 隐藏等待中的珠子，避免 spawnPos 处叠加
            item.object.visible = false;
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
          const beadScaleFactor = 1 / (1 + gapDelta); // 抵消环变大带来的珠子放大，让珠子看起来更小从而显出间隙
          item.object.scale.copy(item.baseScale).multiplyScalar(beadScaleFactor);
          item.object.quaternion.slerpQuaternions(item.startQuat, item.targetQuat, eased);
        });
      }

      applyCamera(detailFactor);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      applyCamera(detailProgressRef.current);
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
  }, [diyModelUrl, braceletScale, braceletOffset, camRadius, camYaw, camPitch]);

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
