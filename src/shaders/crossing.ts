import * as THREE from 'three';

/** SC10 shaders: the gate's anomaly (a swirling lens disc) and the tunnel walls. Ambient motion only. */

export function createAnomalyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpen; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        // spiral arms pulled toward the centre: reads as lensing
        float arms = sin(a * 5.0 + log(max(r, 0.02)) * 9.0 - uTime * 0.8) * 0.5 + 0.5;
        float core = smoothstep(0.55, 0.0, r);
        float rim = smoothstep(0.7, 1.0, r) * (1.0 - smoothstep(0.96, 1.0, r));
        vec3 cold = vec3(0.35, 0.6, 1.0);
        vec3 warm = vec3(1.0, 0.62, 0.3);
        vec3 col = mix(cold, warm, core) * (0.25 + 0.9 * arms * (1.0 - r * 0.5)) + warm * rim * 0.8;
        float alpha = (0.2 + 0.7 * core + 0.5 * rim) * uOpen;
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createTunnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        // u = around the tunnel, v = along it
        float lanes = abs(sin(vUv.x * 3.14159 * 18.0));
        float bands = fract(vUv.y * 22.0 - uTime * 0.6);
        float line = smoothstep(0.08, 0.0, abs(bands - 0.5) - 0.38) * 0.0 + smoothstep(0.5, 0.46, abs(bands - 0.5));
        float laneLine = smoothstep(0.93, 1.0, lanes);
        vec3 a = vec3(0.12, 0.25, 0.6);
        vec3 b = vec3(0.7, 0.28, 0.6);
        vec3 col = mix(a, b, vUv.y) * (0.25 + 0.6 * line) + vec3(0.6, 0.85, 1.0) * laneLine * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
  });
}
