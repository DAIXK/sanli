'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DIY_MODEL_CACHE_KEY = 'bracelet_diy_model_cache';
const DEFAULT_HUMAN_MODEL = '/static/models/Human-Arm-Animation.gltf';
const DEFAULT_BG_IMAGE = '/static/background.png';
const DEFAULT_PLAYBACK_WINDOW = { startRatio: 0.35, endRatio: 0.44 };
const DEFAULT_TARGET_DURATION = 1.6; // seconds
const HUMAN_TRANSFORM = {
  position: [3.4, 1.4, 0],
  rotation: [1, 1, 1],
  scale: [4.5, 4.5, 4.5],
} as const;

type BeadInstance = {
  object: THREE.Object3D;
};

type ModelViewerPageProps = {
  baseModelUrl?: string;
  diyModelUrl?: string;
  backgroundUrl?: string;
};

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

const ModelViewerPage = ({ baseModelUrl, diyModelUrl, backgroundUrl }: ModelViewerPageProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [cachedDiyUrl, setCachedDiyUrl] = useState<string | undefined>(undefined);
  const cachedUrlRef = useRef<string | null>(null);
  const beadInstancesRef = useRef<BeadInstance[]>([]);
  const searchParams = useSearchParams();

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

  const { resolvedBaseModelUrl, resolvedDiyModelUrl, resolvedBgUrl } = useMemo(() => {
    const decodeOrRaw = (value: string | null) => {
      if (!value) return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const resolvedBase =
      baseModelUrl ||
      decodeOrRaw(searchParams?.get('humanModel')) ||
      decodeOrRaw(searchParams?.get('baseModel')) ||
      DEFAULT_HUMAN_MODEL;

    const resolvedDiy =
      cachedDiyUrl ||
      diyModelUrl ||
      decodeOrRaw(searchParams?.get('diyModel')) ||
      decodeOrRaw(searchParams?.get('diy')) ||
      undefined;

    const resolvedBg =
      backgroundUrl ||
      decodeOrRaw(searchParams?.get('bg')) ||
      decodeOrRaw(searchParams?.get('background')) ||
      DEFAULT_BG_IMAGE;

    return { resolvedBaseModelUrl: resolvedBase, resolvedDiyModelUrl: resolvedDiy, resolvedBgUrl: resolvedBg };
  }, [searchParams, baseModelUrl, diyModelUrl, backgroundUrl, cachedDiyUrl]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Reset state so a new DIY model can be loaded cleanly.
    setLoadingError(null);
    setLoadingProgress(0);
    beadInstancesRef.current = [];

    let disposed = false;

    // Scene
    const scene = new THREE.Scene();

    // Background texture
    const bgTexture = new THREE.TextureLoader().load(resolvedBgUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });
    scene.background = bgTexture;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(2, 2, 5);
    camera.lookAt(0, 0, 0);

    // Renderer - Set alpha: true for a transparent background
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Correct color space and tone mapping for PBR materials
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountRef.current.appendChild(renderer.domElement);

    // 环境光贴图，避免材质因缺少反射而显得失真
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;

    // Lighting - Improved for PBR materials
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
    hemisphereLight.position.set(0, 20, 0);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(-10, -10, -10);
    scene.add(directionalLight2);
    
    // Ground has been removed

    // GLTF Loader
    const loader = new GLTFLoader();
    let mixer: THREE.AnimationMixer | null = null;
    let updateBraceletTransform: (() => void) | null = null;
    let animationId = 0;

    loader.load(
      resolvedBaseModelUrl,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;

        //================================================================
        //== 这里控制模型的默认位置、旋转和缩放
        //================================================================
        // model.position.set(x, y, z);
        model.position.set(...HUMAN_TRANSFORM.position); // 举例：将模型沿Y轴向上移动1个单位

        model.rotation.set(...HUMAN_TRANSFORM.rotation); // (in radians)
        // model.rotation.y = Math.PI; // 举例：将模型沿Y轴旋转180度

        // model.scale.set(size, size, size);
        model.scale.set(...HUMAN_TRANSFORM.scale); // 举例：将模型缩小到原来的一半
        //================================================================

        scene.add(model);
        setLoadingProgress(100);

        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          const sourceClip = gltf.animations[0];
          const fullDur = sourceClip.duration; // 原始完整时长（例如 9.7s）
          // 只用配置的窗口片段，生成一次播放的子片段
          const windowStart = Math.max(0, fullDur * DEFAULT_PLAYBACK_WINDOW.startRatio);
          const windowEnd = Math.max(windowStart + 0.0001, fullDur * DEFAULT_PLAYBACK_WINDOW.endRatio); // 防止 0
          const fps = 30;
          const windowClip = THREE.AnimationUtils.subclip(
            sourceClip,
            'windowClip',
            windowStart * fps,
            windowEnd * fps,
            fps
          );
          const action = mixer.clipAction(windowClip);
          action.setLoop(THREE.LoopOnce, 0);
          action.clampWhenFinished = true;
          action.setDuration(DEFAULT_TARGET_DURATION); // 目标总时长
          action.reset().play(); // 默认自动播放一次
        }

        // Attach DIY bracelet as a child of the rope bone so it follows the animation.
        const ropeBone = model.getObjectByName('rope');
        const ropeMesh = model.getObjectByName('RopeMesh'); // 用于参考原手串的朝向
        if (ropeMesh) {
          ropeMesh.visible = false; // 隐藏原有手串
        }
        if (ropeBone) {
          const beadGroup = new THREE.Group();
          beadGroup.name = 'AnimatedBeads';
          ropeBone.add(beadGroup);
          const localToBone = new THREE.Matrix4();
          const targetMatrix = new THREE.Matrix4();
          const targetPos = new THREE.Vector3();
          const targetQuat = new THREE.Quaternion();
          const targetScale = new THREE.Vector3();

          if (!resolvedDiyModelUrl) {
            console.warn('DIY model url missing, skip attaching bracelet');
            setLoadingError('缺少 DIY 模型数据');
          } else {
            const diyLoader = new GLTFLoader();
            diyLoader.load(
              resolvedDiyModelUrl,
              (diyGltf) => {
                if (disposed) return;
                const diyRoot = new THREE.Group();
                diyRoot.name = 'DIYBraceletAttachment';

              // Reset diy scene transform before parenting.
              diyGltf.scene.position.set(0, 0, 0);
              diyGltf.scene.rotation.set(0, 0, 0);
              diyGltf.scene.scale.set(1, 1, 1);

              diyRoot.add(diyGltf.scene);

              // 对齐朝向：DIY 的局部旋转 = inverse(boneWorld) * ropeMeshWorld
              ropeBone.updateMatrixWorld(true);
              ropeMesh?.updateMatrixWorld(true);
              const boneWorldQuat = ropeBone.getWorldQuaternion(new THREE.Quaternion());
              const targetQuat = ropeMesh?.getWorldQuaternion(new THREE.Quaternion());
              if (targetQuat) {
                const localQuat = boneWorldQuat.clone().invert().multiply(targetQuat);
                diyRoot.quaternion.copy(localQuat);
                diyRoot.rotation.x += 0.2;
                diyRoot.rotation.y -= 0.48;
                diyRoot.rotation.z -= 0.4;
                diyRoot.rotateY(0.1);
                diyRoot.rotateX(-0.2);
               
                
              } 

              // 放大 100x 抵消 Armature 的 0.01 缩放，可按需微调位置/缩放。
              diyRoot.position.set(0.5, -0.2, 0);
              diyRoot.scale.set(100, 100, 100);
              const nonUniformScale = new THREE.Vector3(1.05, 1.05, 1.05);
              diyRoot.scale.multiply(nonUniformScale);
              // 抵消非均匀缩放对珠子形状的影响
              const inverseScale = new THREE.Vector3(
                1 / nonUniformScale.x,
                1 / nonUniformScale.y,
                1 / nonUniformScale.z
              );
              diyRoot.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) {
                  (obj as THREE.Mesh).scale.multiply(inverseScale);
                }
              });

              ropeBone.add(diyRoot);

              // 根据 RopeMesh 的包围球自动匹配圈径，可通过 braceletTightness 调整紧度
              if (ropeMesh) {
                ropeBone.updateMatrixWorld(true);
                diyRoot.updateMatrixWorld(true);
                const ropeBox = new THREE.Box3().setFromObject(ropeMesh);
                const diyBox = new THREE.Box3().setFromObject(diyRoot);
                const ropeSphere = ropeBox.getBoundingSphere(new THREE.Sphere());
                const diySphere = diyBox.getBoundingSphere(new THREE.Sphere());
                const braceletTightness = 0.8; // <1 稍微收紧，减少悬空；想更贴合可调小一点
                if (ropeSphere.radius > 0 && diySphere.radius > 0) {
                  const fitScale = (ropeSphere.radius / diySphere.radius) * braceletTightness;
                  diyRoot.scale.multiplyScalar(fitScale);
                  diyRoot.updateMatrixWorld(true);
                  console.log('Auto scale DIY to match RopeMesh (sphere). ratio:', fitScale);
                }
              }

              // 锁定手串世界尺寸，抵消骨骼缩放（例如手变肥导致手串变大）
              const baseLocalPosition = diyRoot.position.clone();
              const baseLocalScale = diyRoot.scale.clone();
              const baseParentScale = new THREE.Vector3();
              const currentParentScale = new THREE.Vector3();
              const safeParentScale = new THREE.Vector3();

              ropeBone.updateMatrixWorld(true);
              ropeBone.getWorldScale(baseParentScale);

              updateBraceletTransform = () => {
                ropeBone.updateMatrixWorld(true);
                ropeBone.getWorldScale(currentParentScale);

                safeParentScale.set(
                  Math.abs(currentParentScale.x) < 1e-6 ? 1e-6 : currentParentScale.x,
                  Math.abs(currentParentScale.y) < 1e-6 ? 1e-6 : currentParentScale.y,
                  Math.abs(currentParentScale.z) < 1e-6 ? 1e-6 : currentParentScale.z
                );

                diyRoot.position.copy(baseLocalPosition).multiply(baseParentScale).divide(safeParentScale);
                diyRoot.scale.copy(baseLocalScale).multiply(baseParentScale).divide(safeParentScale);
              };

              updateBraceletTransform();

              console.log('DIY bracelet attached to rope bone at', ropeBone.getWorldPosition(new THREE.Vector3()));

              // 按顺序逐颗飞入的手串动画
              const beads: BeadInstance[] = [];
              diyRoot.updateMatrixWorld(true);
              ropeBone.updateMatrixWorld(true);
              const ropeWorldInv = localToBone.copy(ropeBone.matrixWorld).invert();

              diyRoot.traverse((obj) => {
                const extras = (obj as any).userData || {};
                if (!extras.isMarbleRoot) return;
                obj.updateMatrixWorld(true);
                targetMatrix.multiplyMatrices(ropeWorldInv, obj.matrixWorld);
                targetMatrix.decompose(targetPos, targetQuat, targetScale);

                const beadClone = obj.clone(true);
                beadClone.position.copy(targetPos);
                beadClone.quaternion.copy(targetQuat);
                beadClone.scale.copy(targetScale);
                beadClone.visible = true;
                beadGroup.add(beadClone);

                beads.push({
                  object: beadClone,
                });

                // 隐藏原始珠子，避免重叠
                obj.visible = false;
              });

              beadInstancesRef.current = beads;
              diyRoot.visible = false; // 仅用于采样，不直接显示
            },
            undefined,
            (error) => {
              if (disposed) return;
              console.error('Failed to load DIY bracelet glTF:', error);
              setLoadingError(`Failed to load DIY model: ${diyModelUrl}.`);
            }
          );
          }
        } else {
          console.warn('rope bone not found; DIY bracelet not attached');
        }
      },
      (xhr) => {
        if (disposed) return;
        const total = xhr.total || 1;
        setLoadingProgress((xhr.loaded / total) * 100);
      },
      (error) => {
        console.error('An error happened during loading:', error);
        if (!disposed) {
          setLoadingError(`Failed to load base model: ${resolvedBaseModelUrl}. Check console for details.`);
        }
      }
    );

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);
      if (updateBraceletTransform) updateBraceletTransform();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement) {
         mountRef.current.removeChild(renderer.domElement);
      }
      bgTexture.dispose();
      pmremGenerator.dispose();
      envMap.dispose?.();
      // Dispose of scene objects and renderer
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      beadInstancesRef.current = [];
    };
  }, [resolvedBaseModelUrl, resolvedDiyModelUrl, resolvedBgUrl]);

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
        margin: 0,
        padding: 0,
      }}
    >
       
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default ModelViewerPage;
