'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DEFAULT_HUMAN_MODEL = '/static/models/Human-Arm-Animation.gltf';
const DEFAULT_DIY_MODEL = '/static/diy.gltf';
const DEFAULT_PLAYBACK_WINDOW = { startRatio: 0.35, endRatio: 0.44 };
const DEFAULT_TARGET_DURATION = 1.6; // seconds
const HUMAN_TRANSFORM = {
  position: [3.4, 1.4, 0],
  rotation: [1, 1, 1],
  scale: [4.5, 4.5, 4.5],
} as const;

const ModelViewerPage = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [animationAction, setAnimationAction] = useState<THREE.AnimationAction | null>(null);
  const [clipDuration, setClipDuration] = useState<number | null>(null); // 实际播放窗口（截取指定片段）
  const [fullClipDuration, setFullClipDuration] = useState<number | null>(null); // 原始完整时长
  const [desiredDuration, setDesiredDuration] = useState<number | null>(null); // 播放窗口完成一次所需时间（用于放慢/加速）
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const progressRef = useRef(0);
  const clipDurationRef = useRef<number | null>(null);
  const clipWindowStartRef = useRef<number | null>(null);
  const fullClipDurationRef = useRef<number | null>(null);
  const animationActionRef = useRef<THREE.AnimationAction | null>(null);
  const searchParams = useSearchParams();

  const { baseModelUrl, diyModelUrl } = useMemo(() => {
    const decodeOrRaw = (value: string | null) => {
      if (!value) return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const resolvedBase =
      decodeOrRaw(searchParams?.get('humanModel')) ||
      decodeOrRaw(searchParams?.get('baseModel')) ||
      DEFAULT_HUMAN_MODEL;

    const resolvedDiy =
      decodeOrRaw(searchParams?.get('diyModel')) ||
      decodeOrRaw(searchParams?.get('diy')) ||
      DEFAULT_DIY_MODEL;

    return { baseModelUrl: resolvedBase, diyModelUrl: resolvedDiy };
  }, [searchParams]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Reset state so a new DIY model can be loaded cleanly.
    setAnimationAction(null);
    setClipDuration(null);
    setFullClipDuration(null);
    setDesiredDuration(null);
    setAnimationProgress(0);
    setIsPlaying(false);
    setLoadingError(null);
    setLoadingProgress(0);
    clipDurationRef.current = null;
    clipWindowStartRef.current = null;
    fullClipDurationRef.current = null;
    animationActionRef.current = null;
    progressRef.current = 0;

    let disposed = false;

    // Scene
    const scene = new THREE.Scene();

    // Background texture
    const bgTexture = new THREE.TextureLoader().load('/static/background.png', (tex) => {
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
      baseModelUrl,
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
          const action = mixer.clipAction(gltf.animations[0]);
          action.setLoop(THREE.LoopRepeat, Infinity);
          const fullDur = gltf.animations[0].duration; // 原始完整时长（例如 9.7s）
          // 只用配置的窗口片段
          const windowStart = Math.max(0, fullDur * DEFAULT_PLAYBACK_WINDOW.startRatio);
          const windowEnd = Math.max(windowStart + 0.0001, fullDur * DEFAULT_PLAYBACK_WINDOW.endRatio); // 防止 0
          const playbackWindow = Math.max(0.0001, windowEnd - windowStart);
          action.time = windowStart;
          const defaultDesired = DEFAULT_TARGET_DURATION; // 默认播放该窗口耗时 1.6 秒（可滑杆调节）
          const timeScale = playbackWindow / defaultDesired;
          action.setEffectiveTimeScale(timeScale);
          setFullClipDuration(fullDur);
          fullClipDurationRef.current = fullDur;
          setClipDuration(playbackWindow);
          clipDurationRef.current = playbackWindow;
          clipWindowStartRef.current = windowStart;
          setDesiredDuration(defaultDesired);
          animationActionRef.current = action;
          setAnimationAction(action);
        }

        // Attach DIY bracelet as a child of the rope bone so it follows the animation.
        const ropeBone = model.getObjectByName('rope');
        const ropeMesh = model.getObjectByName('RopeMesh'); // 用于参考原手串的朝向
        if (ropeMesh) {
          ropeMesh.visible = false; // 隐藏原有手串
        }
        if (ropeBone) {
          const diyLoader = new GLTFLoader();
          diyLoader.load(
            diyModelUrl,
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
            },
            undefined,
            (error) => {
              if (disposed) return;
              console.error('Failed to load DIY bracelet glTF:', error);
              setLoadingError(`Failed to load DIY model: ${diyModelUrl}.`);
            }
          );
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
          setLoadingError(`Failed to load base model: ${baseModelUrl}. Check console for details.`);
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
      if (animationActionRef.current && clipDurationRef.current && clipWindowStartRef.current !== null) {
        // 只在播放窗口内循环，超出则回绕
        const winStart = clipWindowStartRef.current;
        const winLen = clipDurationRef.current;
        const relTime = animationActionRef.current.time - winStart;
        const wrapped = ((relTime % winLen) + winLen) % winLen; // 防负数
        animationActionRef.current.time = winStart + wrapped;
        const progress = Math.max(0, Math.min(100, (wrapped / winLen) * 100));
        if (Math.abs(progress - progressRef.current) > 0.2) {
          progressRef.current = progress;
          setAnimationProgress(progress);
        }
      }
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
    };
  }, [baseModelUrl, diyModelUrl]);

  const toggleAnimation = () => {
    const action = animationActionRef.current;
    if (!action) return;

    setIsPlaying((prev) => {
      if (prev) {
        action.paused = true;
      } else {
        if (action.paused) {
          action.paused = false;
        } else {
          action.play();
        }
      }
      return !prev;
    });
  };

  const handleDurationChange = (newDuration: number) => {
    const action = animationActionRef.current;
    const clipDur = clipDurationRef.current;
    if (!action || !clipDur || Number.isNaN(newDuration) || newDuration <= 0) return;
    const timeScale = clipDur / newDuration;
    action.setEffectiveTimeScale(timeScale);
    setDesiredDuration(newDuration);
  };

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
        <div style={{ 
            position: 'absolute', 
            top: 10, 
            left: 10, 
            zIndex: 10, 
            background: 'rgba(0,0,0,0.5)', 
            color: 'white', 
            padding: '10px', 
            borderRadius: '5px' 
        }}>
            <button onClick={toggleAnimation} disabled={!animationAction || !!loadingError}>
            {isPlaying ? 'Pause Animation' : 'Play Animation'}
            </button>
            {clipDuration && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>
                  播放窗口时长（秒，越大越慢）: {desiredDuration ? desiredDuration.toFixed(1) : '...'} / 窗口 {clipDuration.toFixed(1)}
                  {fullClipDuration ? ` / 原始 ${fullClipDuration.toFixed(1)}` : ''}
                </label>
                <input
                  type="range"
                  min={clipDuration * 0.5}
                  max={clipDuration * 4}
                  step={0.1}
                  value={desiredDuration ?? clipDuration * 2}
                  onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                  style={{ width: '200px' }}
                  disabled={!clipDuration}
                />
              </div>
            )}
            <div style={{ marginTop: '8px', width: '220px' }}>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>动画进度：{animationProgress.toFixed(1)}%</div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${animationProgress}%`, height: '100%', background: '#4caf50' }} />
              </div>
            </div>
            {loadingProgress < 100 && <p>Loading: {Math.round(loadingProgress)}%</p>}
            {loadingError && <p style={{ color: 'red' }}>{loadingError}</p>}
            <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: '16px', wordBreak: 'break-all', maxWidth: '240px' }}>
              <div>Base: {baseModelUrl}</div>
              <div>DIY: {diyModelUrl}</div>
            </div>
        </div>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default ModelViewerPage;
