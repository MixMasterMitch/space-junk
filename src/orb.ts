import { Vector3 } from 'three';
import {kmToModelUnits, log} from './utils';

interface Position {
    x: number;
    y: number;
    z: number;
}

declare class Body {
    constructor();
    xyz(date: Date): Position;
}

declare class Moon extends Body {
    constructor();
}

interface MoonConstructor {
    new (): Moon;
}

declare class Sun extends Body {
    constructor();
}

interface SunConstructor {
    new (): Sun;
}

interface TLE {
    name: string;
    line1: string;
    line2: string;
}

interface _TLE {
    name: string;
    first_line: string;
    second_line: string;
}

declare class Satellite extends Body {
    constructor(elements: _TLE);
}

export type SatelliteData = Satellite;

interface SatelliteConstructor {
    new (elements: _TLE): Satellite;
}

declare const Orb: {
    Moon: MoonConstructor;
    Sun: SunConstructor;
    Satellite: SatelliteConstructor;
    EclipticToEquatorial: (params: { date: Date; ecliptic: Position }) => Position;
};

const sun = new Orb.Sun();
const moon = new Orb.Moon();

function bodyPosition(body: Body, date: Date, eclipticToEquatorial: boolean): Vector3 {
    const xyz = eclipticToEquatorial ? Orb.EclipticToEquatorial({ date: date, ecliptic: body.xyz(date) }) : body.xyz(date);
    return new Vector3(kmToModelUnits(-xyz.y), kmToModelUnits(xyz.z), kmToModelUnits(-xyz.x));
}

export function sunPosition(date: Date): Vector3 {
    return bodyPosition(sun, date, false);
}

export function moonPosition(date: Date): Vector3 {
    return bodyPosition(moon, date, true);
}

export function initializeSatellite(tle: TLE): SatelliteData {
    return new Orb.Satellite({
        name: tle.name,
        first_line: tle.line1,
        second_line: tle.line2,
    });
}

export function satellitePosition(date: Date, satellite: SatelliteData): Vector3 {
    return bodyPosition(satellite, date, false);
}
