'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ModelViewerPage = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [animationAction, setAnimationAction] = useState<THREE.AnimationAction | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(2, 2, 5);

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

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

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

    loader.load(
      '/static/models/Human-Arm-Animation.gltf',
      (gltf) => {
        const model = gltf.scene;
        
        //================================================================
        //== 这里控制模型的默认位置、旋转和缩放
        //================================================================
        // model.position.set(x, y, z);
        model.position.set(3.2, 1.2, 0); // 举例：将模型沿Y轴向上移动1个单位

        model.rotation.set(1, 1, 1); // (in radians)
        // model.rotation.y = Math.PI; // 举例：将模型沿Y轴旋转180度

        // model.scale.set(size, size, size);
        model.scale.set(4.2, 4.2, 4.2); // 举例：将模型缩小到原来的一半
        //================================================================

        scene.add(model);

        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
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
            '/static/diy.gltf',
            (diyGltf) => {
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
              diyRoot.position.set(0.5, 0, 0);
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
              console.error('Failed to load DIY bracelet glTF:', error);
            }
          );
        } else {
          console.warn('rope bone not found; DIY bracelet not attached');
        }
      },
      (xhr) => {
        setLoadingProgress((xhr.loaded / xhr.total) * 100);
      },
      (error) => {
        console.error('An error happened during loading:', error);
        setLoadingError('Failed to load model. Check console for details. Make sure the model file exists at /public/static/models/Human-Arm-Animation.gltf');
      }
    );

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);
      if (updateBraceletTransform) updateBraceletTransform();
      controls.update();
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
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
         mountRef.current.removeChild(renderer.domElement);
      }
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
  }, []);

  const toggleAnimation = () => {
    if (!animationAction) return;

    if (isPlaying) {
      animationAction.paused = true;
    } else {
      if (animationAction.paused) {
        animationAction.paused = false;
      } else {
        animationAction.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)', position: 'relative' }}>
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
            {loadingProgress < 100 && <p>Loading: {Math.round(loadingProgress)}%</p>}
            {loadingError && <p style={{ color: 'red' }}>{loadingError}</p>}
        </div>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default ModelViewerPage;
