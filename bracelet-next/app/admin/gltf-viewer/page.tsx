'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    mountRef.current.appendChild(renderer.domElement);

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
    let mixer: THREE.AnimationMixer;

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

              // Ensure matte look: force materials to be non-metallic and rough.
              diyGltf.scene.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) {
                  const mesh = obj as THREE.Mesh;
                  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  materials.forEach((mat) => {
                    if ('metalness' in mat && 'roughness' in mat) {
                      mat.metalness = 0;
                      mat.roughness = 1;
                      mat.needsUpdate = true;
                    }
                  });
                }
              });

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
              diyRoot.position.set(0, 0, 0);
              diyRoot.scale.set(100, 100, 100);

              ropeBone.add(diyRoot);

              // 根据原 RopeMesh 的包围盒自动匹配圈径（取最大维度的比例）
              if (ropeMesh) {
                ropeBone.updateMatrixWorld(true);
                diyRoot.updateMatrixWorld(true);
                const ropeBox = new THREE.Box3().setFromObject(ropeMesh);
                const diyBox = new THREE.Box3().setFromObject(diyRoot);
                const ropeSize = ropeBox.getSize(new THREE.Vector3());
                const diySize = diyBox.getSize(new THREE.Vector3());
                const ropeMax = Math.max(ropeSize.x, ropeSize.y, ropeSize.z);
                const diyMax = Math.max(diySize.x, diySize.y, diySize.z);
                if (diyMax > 0) {
                  const fitScale = ropeMax / diyMax;
                  diyRoot.scale.multiplyScalar(fitScale);
                  diyRoot.updateMatrixWorld(true);
                  console.log('Auto scale DIY to match RopeMesh. ratio:', fitScale);
                }
              }

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
