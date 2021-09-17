import { Color, ShaderLib, ShaderMaterial, ShaderMaterialParameters, UniformsUtils } from 'three';
import SatelliteSphereVertexShader from './SatelliteSphereVertexShader';
import SatelliteSphereFragmentShader from './SatelliteSphereFragmentShader';

interface SatelliteSphereMaterialProperties extends ShaderMaterialParameters {
    diffuse: Color;
    emissive: Color;
}

export class SatelliteSphereMaterial extends ShaderMaterial {
    constructor(parameters: Partial<SatelliteSphereMaterialProperties>) {
        super({
            uniforms: UniformsUtils.merge([
                ShaderLib.phong.uniforms,
                {
                    diffuse: { value: new Color(0xffffff) },
                    emissive: { value: new Color(0xffffff) },
                },
            ]),
            vertexShader: SatelliteSphereVertexShader,
            fragmentShader: SatelliteSphereFragmentShader,
            lights: true,
        });

        this.type = 'SatelliteSphereMaterial';
        Object.defineProperties(this, {
            diffuse: {
                enumerable: true,
                get: function () {
                    return this.uniforms.diffuse.value;
                },
                set: function (value) {
                    this.uniforms.diffuse.value = value;
                },
            },
            emissive: {
                enumerable: true,
                get: function () {
                    return this.uniforms.emissive.value;
                },
                set: function (value) {
                    this.uniforms.emissive.value = value;
                },
            },
        });

        this.setValues(parameters);
    }
}
