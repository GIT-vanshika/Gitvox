import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const AcousticSphere3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 22;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. Audio Harmonic Torus Ribbon (Voice frequency curves)
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 100; i++) {
      const theta = (i / 100) * Math.PI * 2;
      const r = 6 + Math.sin(theta * 5) * 1.2;
      curvePoints.push(
        new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, Math.sin(theta * 3) * 2)
      );
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    const tubeGeo = new THREE.TubeGeometry(curve, 100, 0.22, 16, true);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber / warm gold
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.5,
    });
    const audioRibbon = new THREE.Mesh(tubeGeo, tubeMat);
    mainGroup.add(audioRibbon);

    // 2. Violet Pulsing Voice Core (Wireframe GeoSphere)
    const coreGeo = new THREE.IcosahedronGeometry(4.2, 3);
    const coreMat = new THREE.MeshLambertMaterial({
      color: 0x8b5cf6, // Electric Violet
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const voiceCore = new THREE.Mesh(coreGeo, coreMat);
    mainGroup.add(voiceCore);

    // Inner solid glow sphere
    const innerGlowGeo = new THREE.SphereGeometry(2.5, 32, 32);
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: 0xec4899, // Hot Magenta glow
      transparent: true,
      opacity: 0.25,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    mainGroup.add(innerGlow);

    // 3. Audio Frequency Equalizer Bar Ring (Interactive Voice Wave)
    const barsGroup = new THREE.Group();
    const barCount = 36;
    const bars: THREE.Mesh[] = [];
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
    for (let i = 0; i < barCount; i++) {
      const rad = (i / barCount) * Math.PI * 2;
      const barMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xf59e0b : 0xa855f7,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(Math.cos(rad) * 8.5, Math.sin(rad) * 8.5, 0);
      bar.rotation.z = rad - Math.PI / 2;
      barsGroup.add(bar);
      bars.push(bar);
    }
    mainGroup.add(barsGroup);

    // 4. Acoustic Cloud Particles (Code tokens)
    const particleCount = 200;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 9 + Math.random() * 4;
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xf43f5e,
      size: 0.25,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeo, pMat);
    mainGroup.add(particles);

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambLight);

    const pLight1 = new THREE.PointLight(0xf59e0b, 2.5, 60);
    pLight1.position.set(15, 12, 15);
    scene.add(pLight1);

    const pLight2 = new THREE.PointLight(0x8b5cf6, 2, 60);
    pLight2.position.set(-15, -10, 10);
    scene.add(pLight2);

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      targetX = (x / rect.width) * 1.5;
      targetY = (y / rect.height) * 1.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      mainGroup.rotation.y = t * 0.25 + mouseX;
      mainGroup.rotation.x = Math.sin(t * 0.2) * 0.2 + mouseY;

      audioRibbon.rotation.z = t * 0.15;
      voiceCore.rotation.y = -t * 0.2;
      barsGroup.rotation.z = -t * 0.1;

      // Modulate equalizer bars like live voice activity
      for (let i = 0; i < barCount; i++) {
        const scale = 1 + Math.sin(t * 4 + i * 0.5) * 1.8 + Math.cos(t * 6 + i) * 0.8;
        bars[i].scale.y = Math.max(0.2, scale);
      }

      // Pulsing core
      const pulse = 1 + Math.sin(t * 2.5) * 0.08;
      voiceCore.scale.set(pulse, pulse, pulse);
      innerGlow.scale.set(pulse * 1.1, pulse * 1.1, pulse * 1.1);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerGlowGeo.dispose();
      innerGlowMat.dispose();
      barGeo.dispose();
      pGeo.dispose();
      pMat.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};
