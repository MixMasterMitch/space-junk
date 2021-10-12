// From https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong_frag.glsl.js
const SatelliteSphereVertexShader = `
#define PHONG
uniform float baseSize;
attribute vec3 translation;
attribute float size;
attribute vec3 diffuse;
attribute vec3 emissive;
varying vec3 vViewPosition;
varying vec3 vDiffuse;
varying vec3 vEmissive;
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
	// Overwrite the "begin_vertex" chunk and apply the translation and scaling to the position.
	// #include <begin_vertex>
	vec3 transformed = vec3( position * baseSize * size + translation );
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
	vDiffuse = diffuse;
	vEmissive = emissive;
}
`;
export default SatelliteSphereVertexShader;
