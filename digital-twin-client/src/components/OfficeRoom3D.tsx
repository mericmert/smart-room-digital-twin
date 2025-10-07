'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SensorDataPoint } from '@/utils/dataParser';

interface OfficeRoom3DProps {
  data?: SensorDataPoint | null;
  width?: number;
  height?: number;
}

interface MetricVisualization {
  occupancy: number;
  temperature: number;
  light: number;
  co2: number;
  humidity: number;
}

export default function OfficeRoom3D({ 
  data, 
  width, 
  height 
}: OfficeRoom3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [predictionResult, setPredictionResult] = useState<any>(null);

  // Listen for prediction results from WebSocket
  useEffect(() => {
    const handlePredictionResult = (event: CustomEvent<any>) => {
      setPredictionResult(event.detail);
    };

    window.addEventListener('predictionResult', handlePredictionResult as EventListener);
    
    return () => {
      window.removeEventListener('predictionResult', handlePredictionResult as EventListener);
    };
  }, []);

  const getMetrics = (data: SensorDataPoint | null, predictionResult?: any): MetricVisualization => {
    // Use prediction result data if available, otherwise fall back to CSV data
    if (predictionResult?.features) {
      return {
        occupancy: predictionResult.occupancy, // Use predicted occupancy
        temperature: predictionResult.features.Temperature,
        light: predictionResult.features.Light,
        co2: predictionResult.features.CO2,
        humidity: predictionResult.features.Humidity
      };
    }
    
    if (!data) {
      return {
        occupancy: 0,
        temperature: 20,
        light: 0,
        co2: 400,
        humidity: 50
      };
    }

    return {
      occupancy: data.Occupancy,
      temperature: data.Temperature,
      light: data.Light,
      co2: data.CO2,
      humidity: data.Humidity
    };
  };

  // Color mapping functions
  const getTemperatureColor = (temp: number): THREE.Color => {
    // Map temperature to color: blue (cold) -> green (normal) -> red (hot)
    const normalized = Math.max(0, Math.min(1, (temp - 15) / 15)); // 15-30°C range
    if (normalized < 0.5) {
      return new THREE.Color().lerpColors(
        new THREE.Color(0x0000ff), // Blue
        new THREE.Color(0x00ff00), // Green
        normalized * 2
      );
    } else {
      return new THREE.Color().lerpColors(
        new THREE.Color(0x00ff00), // Green
        new THREE.Color(0xff0000), // Red
        (normalized - 0.5) * 2
      );
    }
  };

  const getCO2Color = (co2: number): THREE.Color => {
    // Map CO2 to color: green (good) -> yellow (moderate) -> red (poor)
    const normalized = Math.max(0, Math.min(1, (co2 - 400) / 1000)); // 400-1400 ppm range
    if (normalized < 0.5) {
      return new THREE.Color().lerpColors(
        new THREE.Color(0x00ff00), // Green
        new THREE.Color(0xffff00), // Yellow
        normalized * 2
      );
    } else {
      return new THREE.Color().lerpColors(
        new THREE.Color(0xffff00), // Yellow
        new THREE.Color(0xff0000), // Red
        (normalized - 0.5) * 2
      );
    }
  };

  const getLightIntensity = (light: number): number => {
    // Map light value to intensity (0-1)
    return Math.max(0, Math.min(1, light / 1000));
  };

  const getHumidityEffect = (humidity: number): number => {
    // Map humidity to particle density (0-1)
    return Math.max(0, Math.min(1, humidity / 100));
  };

  const getHumidityColor = (humidity: number): THREE.Color => {
    // Map humidity to color: blue (low) -> cyan (medium) -> white (high)
    const normalized = Math.max(0, Math.min(1, humidity / 100));
    if (normalized < 0.5) {
      return new THREE.Color().lerpColors(
        new THREE.Color(0x0000ff), // Blue
        new THREE.Color(0x00ffff), // Cyan
        normalized * 2
      );
    } else {
      return new THREE.Color().lerpColors(
        new THREE.Color(0x00ffff), // Cyan
        new THREE.Color(0xffffff), // White
        (normalized - 0.5) * 2
      );
    }
  };

  // Handle resize
  const handleResize = useCallback(() => {
    if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

    const container = mountRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Update dimensions state
    setDimensions({ width: containerWidth, height: containerHeight });

    // Update camera aspect ratio
    cameraRef.current.aspect = containerWidth / containerHeight;
    cameraRef.current.updateProjectionMatrix();

    // Update renderer size
    rendererRef.current.setSize(containerWidth, containerHeight);
  }, []);

  // Initialize Three.js scene
  const initScene = () => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const containerWidth = width || container.clientWidth;
    const containerHeight = height || container.clientHeight;

    // Update dimensions state
    setDimensions({ width: containerWidth, height: containerHeight });

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerWidth, containerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create room geometry
    createRoom(scene);
    setIsInitialized(true);
  };

  // Create the office room
  const createRoom = (scene: THREE.Scene) => {
    // Room dimensions
    const roomWidth = 8;
    const roomHeight = 3;
    const roomDepth = 6;

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -roomHeight / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    
    // Back wall
    const backWallGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, 0, -roomDepth / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall
    const leftWallGeometry = new THREE.PlaneGeometry(roomDepth, roomHeight);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-roomWidth / 2, 0, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWallGeometry = new THREE.PlaneGeometry(roomDepth, roomHeight);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.set(roomWidth / 2, 0, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0xf8f8f8 });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight / 2;
    scene.add(ceiling);

    // Add some furniture
    addFurniture(scene, roomWidth, roomHeight, roomDepth);
  };

  // Add furniture to the room
  const addFurniture = (scene: THREE.Scene, roomWidth: number, roomHeight: number, roomDepth: number) => {
    // Desk
    const deskGeometry = new THREE.BoxGeometry(2, 0.1, 1);
    const deskMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.position.set(0, -roomHeight / 2 + 0.75, 1);
    desk.castShadow = true;
    scene.add(desk);

    // Chair
    const chairGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const chairMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
    const chair = new THREE.Mesh(chairGeometry, chairMaterial);
    chair.position.set(0, -roomHeight / 2 + 0.5, 0.5);
    chair.castShadow = true;
    scene.add(chair);

    // Plants
    for (let i = 0; i < 3; i++) {
      const plantGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1);
      const plantMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
      const plant = new THREE.Mesh(plantGeometry, plantMaterial);
      plant.position.set(
        -roomWidth / 2 + 1 + i * 1.5,
        -roomHeight / 2 + 0.5,
        -roomDepth / 2 + 1
      );
      plant.castShadow = true;
      scene.add(plant);
    }
  };

  // Update room based on sensor data
  const updateRoom = (metrics: MetricVisualization) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const roomHeight = 3; // Room height constant

    // Update wall colors based on temperature and humidity
    const tempColor = getTemperatureColor(metrics.temperature);
    const humidityColor = getHumidityColor(metrics.humidity);
    const combinedColor = tempColor.clone().lerp(humidityColor, 0.3); // Blend temperature and humidity colors
    
    scene.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        if (child.geometry instanceof THREE.PlaneGeometry && child.position.y === 0) {
          child.material.color = combinedColor;
        }
      }
    });

    // Update lighting based on light sensor
    const lightIntensity = getLightIntensity(metrics.light);
    scene.children.forEach(child => {
      if (child instanceof THREE.DirectionalLight) {
        child.intensity = 0.3 + lightIntensity * 0.7;
      }
    });

    // Add CO2 indicators (colored spheres)
    // Remove existing CO2 indicators
    const co2Indicators = scene.children.filter(child => 
      child.userData.type === 'co2Indicator'
    );
    co2Indicators.forEach(indicator => scene.remove(indicator));

    // Add new CO2 indicators
    const co2Color = getCO2Color(metrics.co2);
    const co2Geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const co2Material = new THREE.MeshBasicMaterial({ 
      color: co2Color,
      transparent: true,
      opacity: 0.7
    });
    
    for (let i = 0; i < 5; i++) {
      const co2Indicator = new THREE.Mesh(co2Geometry, co2Material);
      co2Indicator.position.set(
        -2 + i * 1,
        1,
        -2.5
      );
      co2Indicator.userData.type = 'co2Indicator';
      scene.add(co2Indicator);
    }

    // Add occupancy indicators (people)
    // Remove existing people
    const people = scene.children.filter(child => 
      child.userData.type === 'person'
    );
    people.forEach(person => scene.remove(person));

    // Add people based on occupancy
    for (let i = 0; i < metrics.occupancy; i++) {
      const personGroup = new THREE.Group();
      
      // Head
      const headGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const headMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xFFDBB5 // Skin color
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 1.4;
      head.castShadow = true;
      personGroup.add(head);
      
      // Torso
      const torsoGeometry = new THREE.BoxGeometry(0.3, 0.6, 0.2);
      const torsoMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x4169E1 // Royal blue shirt
      });
      const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
      torso.position.y = 0.8;
      torso.castShadow = true;
      personGroup.add(torso);
      
      // Arms
      const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
      const armMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xFFDBB5 // Skin color
      });
      
      // Left arm
      const leftArm = new THREE.Mesh(armGeometry, armMaterial);
      leftArm.position.set(-0.25, 0.8, 0);
      leftArm.rotation.z = Math.PI / 4;
      leftArm.castShadow = true;
      personGroup.add(leftArm);
      
      // Right arm
      const rightArm = new THREE.Mesh(armGeometry, armMaterial);
      rightArm.position.set(0.25, 0.8, 0);
      rightArm.rotation.z = -Math.PI / 4;
      rightArm.castShadow = true;
      personGroup.add(rightArm);
      
      // Legs
      const legGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.7);
      const legMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x2F4F4F // Dark gray pants
      });
      
      // Left leg
      const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
      leftLeg.position.set(-0.1, 0.15, 0);
      leftLeg.castShadow = true;
      personGroup.add(leftLeg);
      
      // Right leg
      const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
      rightLeg.position.set(0.1, 0.15, 0);
      rightLeg.castShadow = true;
      personGroup.add(rightLeg);
      
      // Position the entire person
      personGroup.position.set(
        -1 + i * 0.8,
        -roomHeight / 2 + 0.35,
        0.5
      );
      personGroup.userData.type = 'person';
      scene.add(personGroup);
    }

    // Add humidity particles
    // Remove existing particles
    const particles = scene.children.filter(child => 
      child.userData.type === 'humidityParticle'
    );
    particles.forEach(particle => scene.remove(particle));

    const humidityEffect = getHumidityEffect(metrics.humidity);
    if (humidityEffect > 0.2) { // Lowered threshold to show humidity particles
      const particleCount = Math.floor(humidityEffect * 100); // Increased particle count
      const particleGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 8;
        positions[i * 3 + 1] = Math.random() * 3;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      }
      
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x87CEEB,
        size: 0.1, // Increased particle size
        transparent: true,
        opacity: 0.8 // Increased opacity
      });
      
      const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
      particleSystem.userData.type = 'humidityParticle';
      scene.add(particleSystem);
    }

    // Add humidity ratio indicator (floating spheres)
    // Remove existing humidity ratio indicators
    const humidityRatioIndicators = scene.children.filter(child => 
      child.userData.type === 'humidityRatioIndicator'
    );
    humidityRatioIndicators.forEach(indicator => scene.remove(indicator));

    // Add humidity ratio visual indicator
    const humidityRatioEffect = Math.max(0, Math.min(1, (metrics.humidity - 20) / 10)); // Map humidity ratio to 0-1
    if (humidityRatioEffect > 0.1) {
      const indicatorCount = Math.floor(humidityRatioEffect * 8);
      for (let i = 0; i < indicatorCount; i++) {
        const indicatorGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00BFFF, // Deep sky blue
          transparent: true,
          opacity: 0.7
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(
          -3 + i * 0.8,
          2.5,
          -2.5
        );
        indicator.userData.type = 'humidityRatioIndicator';
        scene.add(indicator);
      }
    }
  };

  // Animation loop
  const animate = () => {
    if (sceneRef.current && cameraRef.current && rendererRef.current) {
      // Rotate camera slightly for better view
      const time = Date.now() * 0.0005;
      cameraRef.current.position.x = Math.cos(time) * 8;
      cameraRef.current.position.z = Math.sin(time) * 8;
      cameraRef.current.lookAt(0, 0, 0);

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  };

  // Initialize and cleanup
  useEffect(() => {
    initScene();
    
    // Set up resize observer
    if (mountRef.current && !width && !height) {
      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(mountRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [handleResize, width, height]);

  // Start animation loop
  useEffect(() => {
    if (isInitialized) {
      animate();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isInitialized]);

  // Update room when data changes
  useEffect(() => {
    if (isInitialized && (data || predictionResult)) {
      const metrics = getMetrics(data || null, predictionResult);
      updateRoom(metrics);
    }
  }, [data, predictionResult, isInitialized]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div 
        ref={mountRef} 
        className="w-full aspect-[3/2] min-h-[400px] rounded-lg overflow-hidden"
        style={width && height ? { width, height } : {}}
      />
      {data && (
        <div className="mt-4 p-4 card">
          <h3 className="heading-3 mb-2">Current Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-foreground rounded-full"></div>
              <span>Occupancy: {data.Occupancy}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-temperature rounded-full"></div>
              <span>Temp: {data.Temperature.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-light rounded-full"></div>
              <span>Light: {data.Light.toFixed(0)} lux</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-co2 rounded-full"></div>
              <span>CO2: {data.CO2.toFixed(0)} ppm</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-humidity rounded-full"></div>
              <span>Humidity: {data.Humidity.toFixed(1)}%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-info rounded-full"></div>
              <span>H.Ratio: {data.HumidityRatio.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
