import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

// Shader Materials for Filters (Deobfuscated Logic)

const BlurShaderMaterial = ({ blur = 4, quality = 3, clamp = false }) => {
  const uniforms = useMemo(
    () => ({
      uMap: { value: null },
      uOffset: { value: new THREE.Vector2() },
      filterClamp: { value: new THREE.Vector4() }, // Add filterClamp uniform
    }),
    []
  );

  useEffect(() => {
    uniforms.uOffset.value.set(0, 0); // Initialize offset
  }, []);

  const fragmentShader = useMemo(
    () =>
      clamp
        ? `
        uniform sampler2D uMap;
        uniform vec2 uOffset;
        varying vec2 vUv;
        uniform vec4 filterClamp;

        void main() {
            vec4 color = vec4(0.0);

            // Sample top left pixel
            color += texture2D(uMap, clamp(vec2(vUv.x - uOffset.x, vUv.y + uOffset.y), filterClamp.xy, filterClamp.zw));

            // Sample top right pixel
            color += texture2D(uMap, clamp(vec2(vUv.x + uOffset.x, vUv.y + uOffset.y), filterClamp.xy, filterClamp.zw));

            // Sample bottom right pixel
            color += texture2D(uMap, clamp(vec2(vUv.x + uOffset.x, vUv.y - uOffset.y), filterClamp.xy, filterClamp.zw));

            // Sample bottom left pixel
            color += texture2D(uMap, clamp(vec2(vUv.x - uOffset.x, vUv.y - uOffset.y), filterClamp.xy, filterClamp.zw));

            color *= 0.25;
            gl_FragColor = color;
        }
        `
        : `
        uniform sampler2D uMap;
        uniform vec2 uOffset;
        varying vec2 vUv;

        void main() {
            vec4 color = vec4(0.0);

            // Sample top left pixel
            color += texture2D(uMap, vec2(vUv.x - uOffset.x, vUv.y + uOffset.y));

            // Sample top right pixel
            color += texture2D(uMap, vec2(vUv.x + uOffset.x, vUv.y + uOffset.y));

            // Sample bottom right pixel
            color += texture2D(uMap, vec2(vUv.x + uOffset.x, vUv.y - uOffset.y));

            // Sample bottom left pixel
            color += texture2D(uMap, vec2(vUv.x - uOffset.x, vUv.y - uOffset.y));

            color *= 0.25;
            gl_FragColor = color;
        }
        `,
    [clamp]
  );

  const blurKernels = useMemo(() => {
    const kernels = [];
    let currentBlur = blur;
    const blurStep = blur / quality;
    for (let i = 0; i < quality; i++) {
      currentBlur -= blurStep;
      kernels.push(currentBlur);
    }
    return kernels;
  }, [blur, quality]);

  useFrame((state) => {
    const pixelSizeX = 1 / state.size.width; // Calculate pixel size based on canvas size
    const pixelSizeY = 1 / state.size.height;

    let blurKernel;
    if (quality === 1 || blur === 0) {
      blurKernel = blurKernels[0] + 0.5;
      uniforms.uOffset.value.set(
        blurKernel * pixelSizeX,
        blurKernel * pixelSizeY
      );
    } else {
      // For multi-pass blur, you'd need to manage multiple render targets or use a postprocessing chain in Three.js.
      // This simple example only applies the first blur kernel.
      blurKernel = blurKernels[0] + 0.5; // Using only the first kernel for simplicity in this example
      uniforms.uOffset.value.set(
        blurKernel * pixelSizeX,
        blurKernel * pixelSizeY
      );
    }
    uniforms.filterClamp.value.set(0, 0, 1, 1); // Set filterClamp uniform
  });

  return <shaderMaterial fragmentShader={fragmentShader} uniforms={uniforms} />;
};

const TwistShaderMaterial = ({
  radius = 200,
  angle = 4,
  offset = new THREE.Vector2(),
}) => {
  const uniforms = useMemo(
    () => ({
      uMap: { value: null },
      radius: { value: radius },
      angle: { value: angle },
      offset: { value: offset },
      filterArea: { value: new THREE.Vector4() },
    }),
    [radius, angle, offset]
  );

  const fragmentShader = useMemo(
    () => `
        uniform sampler2D uMap;
        uniform float radius;
        uniform float angle;
        uniform vec2 offset;
        varying vec2 vUv;
        uniform vec4 filterArea;


        vec2 mapCoord( vec2 coord )
        {
            coord *= filterArea.xy;
            coord += filterArea.zw;
            return coord;
        }

        vec2 unmapCoord( vec2 coord )
        {
            coord -= filterArea.zw;
            coord /= filterArea.xy;
            return coord;
        }

        vec2 twist(vec2 coord)
        {
            coord -= offset;
            float dist = length(coord);
            if (dist < radius)
            {
                float ratioDist = (radius - dist) / radius;
                float angleMod = ratioDist * ratioDist * angle;
                float s = sin(angleMod);
                float c = cos(angleMod);
                coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);
            }
            coord += offset;
            return coord;
        }

        void main() {
            vec2 coord = mapCoord(vUv);
            coord = twist(coord);
            coord = unmapCoord(coord);
            gl_FragColor = texture2D(uMap, coord);
        }
    `,
    []
  );

  useFrame((state) => {
    uniforms.filterArea.value.set(state.size.width, state.size.height, 0, 0);
  });

  return <shaderMaterial fragmentShader={fragmentShader} uniforms={uniforms} />;
};

const ColorAdjustShaderMaterial = ({
  gamma = 1,
  saturation = 1,
  contrast = 1,
  brightness = 1,
  red = 1,
  green = 1,
  blue = 1,
  alpha = 1,
}) => {
  const uniforms = useMemo(
    () => ({
      uMap: { value: null },
      gamma: { value: gamma },
      saturation: { value: saturation },
      contrast: { value: contrast },
      brightness: { value: brightness },
      red: { value: red },
      green: { value: green },
      blue: { value: blue },
      alpha: { value: alpha },
    }),
    [gamma, saturation, contrast, brightness, red, green, blue, alpha]
  );

  const fragmentShader = useMemo(
    () => `
        uniform sampler2D uMap;
        varying vec2 vUv;

        uniform float gamma;
        uniform float contrast;
        uniform float saturation;
        uniform float brightness;
        uniform float red;
        uniform float green;
        uniform float blue;
        uniform float alpha;


        void main() {
            vec4 c = texture2D(uMap, vUv);

            if (c.a > 0.0) {
                c.rgb /= c.a;

                vec3 rgb = pow(c.rgb, vec3(1. / gamma));
                rgb = mix(vec3(.5), mix(vec3(dot(vec3(.2125, .7154, .0721), rgb)), rgb, saturation), contrast);
                rgb.r *= red;
                rgb.g *= green;
                rgb.b *= blue;
                c.rgb = rgb * brightness;

                c.rgb *= c.a;
            }

            gl_FragColor = c * alpha;
        }
    `,
    []
  );

  return <shaderMaterial fragmentShader={fragmentShader} uniforms={uniforms} />;
};

// LyricsScene Component using React Three Fiber
const LyricsSceneComponent = ({ artworkURL }) => {
  const artworkTexture = useLoader(THREE.TextureLoader, artworkURL);
  const containerRef = useRef();
  const spritesRef = useRef([]);
  const reduceMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  const [spriteRotations, setSpriteRotations] = React.useState(
    Array(4).fill(0)
  );

  useEffect(() => {
    if (artworkTexture) {
      const sprites = createSprites(artworkTexture);
      spritesRef.current = sprites;
      if (containerRef.current) {
        containerRef.current.add(...sprites);
      }

      let animationProgress = 1;
      let currentSpriteRotations = Array(4).fill(0);
      setSpriteRotations(currentSpriteRotations);

      const animationLoop = () => {
        if (animationProgress <= 0) {
          containerRef.current.remove(...sprites);
          return;
        }

        animationProgress -= 0.02;
        sprites.forEach((sprite, index) => {
          let updatedRotations = [...currentSpriteRotations];
          if (reduceMotionQuery.matches) {
            updatedRotations[index] += 0.001;
          } else {
            if (index === 0) updatedRotations[index] += 0.003;
            if (index === 1) updatedRotations[index] -= 0.008;
            if (index === 2) updatedRotations[index] -= 0.006;
            if (index === 3) updatedRotations[index] += 0.004;
          }

          currentSpriteRotations = updatedRotations;
          setSpriteRotations(updatedRotations);

          sprite.rotation.z = updatedRotations[index];
          if (index === 2) {
            sprite.position.x =
              containerRef.current.userData.screenWidth / 2 +
              (containerRef.current.userData.screenWidth / 4) *
                Math.cos(updatedRotations[2] * 0.75);
            sprite.position.y =
              containerRef.current.userData.screenHeight / 2 +
              (containerRef.current.screenWidth / 4) *
                Math.sin(updatedRotations[2] * 0.75);
          }
          if (index === 3) {
            sprite.position.x =
              containerRef.current.userData.screenWidth / 2 +
              (containerRef.current.screenWidth / 2) * 0.1 +
              (containerRef.current.screenWidth / 4) *
                Math.cos(updatedRotations[3] * 0.75);
            sprite.position.y =
              containerRef.current.userData.screenHeight / 2 +
              (containerRef.current.screenWidth / 2) * 0.1 +
              (containerRef.current.screenWidth / 4) *
                Math.sin(updatedRotations[3] * 0.75);
          }
        });
        requestAnimationFrame(animationLoop);
      };

      animationLoop();
    }
  }, [artworkTexture]);

  const createSprites = (texture) => {
    const sprites = [];
    for (let i = 0; i < 4; i++) {
      const sprite = (
        <mesh key={i} position={[0, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            transparent={true}
            blending={THREE.NormalBlending}
            opacity={0}
          />
        </mesh>
      );
      sprites.push(sprite);
    }
    return sprites;
  };

  const filters = useMemo(
    () => [
      <BlurShaderMaterial key="blur1" blur={5} quality={1} />,
      <BlurShaderMaterial key="blur2" blur={10} quality={1} />,
      <BlurShaderMaterial key="blur3" blur={20} quality={2} />,
      <BlurShaderMaterial key="blur4" blur={40} quality={2} />,
      <BlurShaderMaterial key="blur5" blur={80} quality={2} />,
      <TwistShaderMaterial
        key="twist"
        angle={-3.25}
        radius={900}
        offset={new THREE.Vector2(0, 0)}
      />,
      <ColorAdjustShaderMaterial
        key="colorAdjust"
        saturation={2.75}
        brightness={0.7}
        contrast={1.9}
      />,
    ],
    []
  );

  return (
    <group
      ref={containerRef}
      userData={{
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      }}
    >
      {spritesRef.current.map((sprite, index) => (
        <primitive key={index} object={sprite} material={filters} />
      ))}
    </group>
  );
};

const App = () => {
  return (
    <Canvas orthographic camera={{ zoom: 100, position: [0, 0, 5] }}>
      <LyricsSceneComponent artworkURL="https://resources.tidal.com/images/160b9682/b0cb/4684/b5f5/1a6c2eb4aac4/1280x1280.jpg" />
      {/* Replace with your image URL */}
    </Canvas>
  );
};

export default App;
