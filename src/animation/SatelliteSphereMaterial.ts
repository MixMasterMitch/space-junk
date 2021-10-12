import {Color, ShaderLib, ShaderMaterial, ShaderMaterialParameters, UniformsUtils, Vector3} from 'three';
import SatelliteSphereVertexShader from './SatelliteSphereVertexShader';
import SatelliteSphereFragmentShader from './SatelliteSphereFragmentShader';

interface SatelliteSphereMaterialProperties extends ShaderMaterialParameters {
    specular: Color;
    shininess: number;
    baseSize: number;
}

export class SatelliteSphereMaterial extends ShaderMaterial {
    public baseSize = null as unknown as number; // Indirectly set in constructor
    constructor(parameters: Partial<SatelliteSphereMaterialProperties>) {
        super({
            uniforms: UniformsUtils.merge([
                ShaderLib.phong.uniforms,
                {
                    specular: { value: new Color(0xffffff) },
                    shininess: { value: 1 },
                    baseSize: { value: 1 },
                },
            ]),
            vertexShader: SatelliteSphereVertexShader,
            fragmentShader: SatelliteSphereFragmentShader,
            lights: true,
        });

        this.type = 'SatelliteSphereMaterial';
        Object.defineProperties(this, {
            specular: {
                enumerable: true,
                get: function () {
                    return this.uniforms.specular.value;
                },
                set: function (value) {
                    this.uniforms.specular.value = value;
                },
            },
            shininess: {
                enumerable: true,
                get: function () {
                    return this.uniforms.shininess.value;
                },
                set: function (value) {
                    this.uniforms.shininess.value = value;
                },
            },
            baseSize: {
                enumerable: true,
                get: function () {
                    return this.uniforms.baseSize.value;
                },
                set: function (value) {
                    this.uniforms.baseSize.value = value;
                },
            },
        });

        this.setValues(parameters);
    }
}
