import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/**
 * The opening's night: a deep sky drawn per view direction, with slow rose and violet nebulae,
 * a faint Milky Way, and thousands of stars twinkling at their own pace. It sits behind the
 * emblem and the threshold, and hands over to the garden's own sky as she enters it.
 */
export class StarSky {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uTime: globalUniforms.uTime,
    uAmt: { value: 0 },
    uCamWorld: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    uGlow: { value: 0 },
  };

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        transparent: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
        uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          uniform mat4 uCamWorld, uProjInv;
          varying vec3 vDir;
          void main(){
            vec4 v = uProjInv * vec4(position.xy, 1., 1.);
            vDir = mat3(uCamWorld) * (v.xyz / v.w);
            gl_Position = vec4(position.xy, .9999, 1.);
          }`,
        fragmentShader: /* glsl */ `
          ${math}
          ${noise}
          uniform float uTime, uAmt, uGlow;
          varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float t = uTime * .006;
            // deep night, a little lighter low down
            vec3 col = mix(vec3(.008, .01, .03), vec3(.02, .015, .045), smoothstep(.6, -.4, d.y));
            // nebulae: two layers of soft cloud drifting past each other
            // (sampled in 3D on the sky sphere, so there is no seam anywhere around it)
            float n1 = fbm3(d * 1.6 + vec3(t, -t * .4, 0.)) * .5 + .5;
            float n2 = snoise(d * 3.2 - vec3(t * 1.4, t, 0.) + n1 * 1.3) * .5 + .5;
            float cloud = smoothstep(.5, 1., n1 * .62 + n2 * .55);
            col += vec3(.16, .045, .12) * cloud * .32 + vec3(.07, .055, .18) * pow(cloud, 2.) * .38;
            // a faint Milky Way across the frame
            vec3 nb = normalize(vec3(.5, .8, .3));
            float bd = dot(d, nb);
            float band = exp(-bd * bd * 18.);
            col += vec3(.28, .24, .4) * band * (.05 + .12 * n2);
            // a warm breath of light behind the emblem as the opening wakes
            float c = length(vec2(d.x, d.y - .02));
            col += vec3(.9, .45, .45) * exp(-c * c * 30.) * .08 * uGlow;
            // stars at three depths, each twinkling on its own
            for (int k = 0; k < 3; k++){
              float sc = 180. + float(k) * 160.;
              vec3 cell = floor(d * sc);
              float h = hash12(cell.xy + cell.z * 13.7 + float(k) * 7.);
              vec3 f = fract(d * sc) - .5;
              float st = step(.992 - band * .01, h) * smoothstep(.35, 0., length(f.xy + f.z * .3));
              col += st * (.35 + .65 * pow(.5 + .5 * sin(uTime * (.6 + h * 3.) + h * 60.), 2.)) * (1. - float(k) * .28) * mix(vec3(.85, .88, 1.), vec3(1., .86, .7), hash12(cell.yz));
            }
            gl_FragColor = vec4(col, uAmt);
          }`,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -999;
  }

  update(camera: THREE.PerspectiveCamera, amt: number, glow: number) {
    this.uniforms.uAmt.value = amt;
    this.uniforms.uGlow.value = glow;
    this.mesh.visible = amt > 0.001;
    if (!this.mesh.visible) return;
    camera.updateMatrixWorld();
    this.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    this.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  }
}
