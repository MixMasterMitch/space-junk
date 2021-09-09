import {
    Camera,
    Mesh,
    Renderer,
    Scene,
    SphereBufferGeometry,
    UniformsUtils,
    ShaderLib,
    ShaderMaterial,
    Color,
    InstancedBufferGeometry,
    InstancedBufferAttribute,
} from 'three';
import Earth from './Earth';
import { GUIData } from './index';
import Satellite from './Satellite';
import { log } from '../utils';

export default class Satellites {
    private satelliteData?: Satellite[];
    private spheres?: Mesh;

    private static NUM_SATELLITES = 50000;

    // From https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong_vert.glsl.js
    private static VERTEX_SHADER = `
#define PHONG
attribute vec3 translation;
varying vec3 vViewPosition;
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	// Overwrite the "begin_vertex" chunk and apply the translation to the position.
	// #include <begin_vertex>
	vec3 transformed = vec3( position + translation );
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}
`;

    // From https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong_frag.glsl.js
    private static FRAG_SHADER = `
#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	// accumulation
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	// modulation
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <output_fragment>
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}
`;

    public async initialize(scene: Scene, renderer: Renderer): Promise<void> {
        // Initialize all of the satellite data
        this.satelliteData = [];
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = new Satellite(Math.round((Math.random() - 0.5) * 14 * 24 * 60 * 60 * 1000), Math.random() + 1, 60 * 1000);
            await satelliteData.initialize(scene, renderer);
            this.satelliteData.push(satelliteData);
        }

        // The satellite spheres geometry is stored as an InstancedBufferGeometry, meaning that all of the spheres are rendered as a single geometry,
        // with some properties (e.g. the vertices of the sphere shape) being shared across all instances (i.e. individual spheres) and other properties
        // (e.g. the translation of each sphere) are set per instance.
        // The translation math to shift the position of each vertex of each sphere is being done in the GPU to free up the CPU.
        const geometry = new InstancedBufferGeometry().copy(new SphereBufferGeometry(Earth.RADIUS * 0.01, 12, 8));
        geometry.instanceCount = Satellites.NUM_SATELLITES;
        geometry.setAttribute('translation', new InstancedBufferAttribute(new Float32Array(Satellites.NUM_SATELLITES * 3), 3));

        const material = new ShaderMaterial({
            uniforms: UniformsUtils.merge([
                ShaderLib.phong.uniforms,
                { diffuse: { value: new Color(0xffffff) } },
                { emissive: { value: new Color(0xffc602).multiplyScalar(0.5) } },
            ]),
            vertexShader: Satellites.VERTEX_SHADER,
            fragmentShader: Satellites.FRAG_SHADER,
            lights: true,
            name: 'satellite-material',
        });
        this.spheres = new Mesh(geometry, material);
        this.spheres.receiveShadow = true;
        scene.add(this.spheres);
    }

    public render(date: Date, camera: Camera, guiData: GUIData): void {
        if (!this.satelliteData || !this.spheres) {
            return;
        }
        // For each satellite, get an updated position and save it to the translation array
        for (let i = 0; i < Satellites.NUM_SATELLITES; i++) {
            const satelliteData = this.satelliteData[i];
            const array = this.spheres.geometry.attributes.translation.array as Float32Array;
            const position = satelliteData.getPosition(date);
            array[i * 3] = position.x;
            array[i * 3 + 1] = position.y;
            array[i * 3 + 2] = position.z;
        }

        this.spheres.geometry.attributes.translation.needsUpdate = true;
    }
}
