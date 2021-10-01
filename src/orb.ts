import { Vector3 } from 'three';
import { kmPerSecondToModelUnits, kmToModelUnits } from './utils';

interface Position {
    x: number;
    y: number;
    z: number;
    xdot?: number;
    ydot?: number;
    zdot?: number;
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

declare global {
    const Orb: {
        Moon: MoonConstructor;
        Sun: SunConstructor;
        Satellite: SatelliteConstructor;
        EclipticToEquatorial: (params: { date: Date; ecliptic: Position }) => Position;
    };
}

let sun: Sun;
let moon: Moon;

/**
 * @param body Which body (sun, moon, satellite, etc.) to get a position of.
 * @param date The point in time to get the body's position at.
 * @param eclipticToEquatorial Some bodies return their position in ecliptic coordinates. Setting this flag will flip back to equatorial coordinates.
 * @param outputPosition Vector to put the output position into. Using this saves an object creation.
 * @param outputVelocity Optional vector to put the output velocity into. Using this saves an object creation.
 */
function bodyPosition(body: Body, date: Date, eclipticToEquatorial: boolean, outputPosition: Vector3, outputVelocity?: Vector3): void {
    const xyz = eclipticToEquatorial ? Orb.EclipticToEquatorial({ date: date, ecliptic: body.xyz(date) }) : body.xyz(date);
    // Orb library returns a position in km and uses a different coordinate orientation.
    outputPosition.set(kmToModelUnits(-xyz.y), kmToModelUnits(xyz.z), kmToModelUnits(-xyz.x));
    if (outputVelocity !== undefined && xyz.xdot !== undefined && xyz.ydot !== undefined && xyz.zdot !== undefined) {
        outputVelocity.set(kmPerSecondToModelUnits(-xyz.ydot), kmPerSecondToModelUnits(xyz.zdot), kmPerSecondToModelUnits(-xyz.xdot));
    }
}

export function sunPosition(date: Date, outputPosition: Vector3, outputVelocity?: Vector3): void {
    if (sun === undefined) {
        sun = new Orb.Sun();
    }
    return bodyPosition(sun, date, false, outputPosition, outputVelocity);
}

export function moonPosition(date: Date, outputPosition: Vector3, outputVelocity?: Vector3): void {
    if (moon === undefined) {
        moon = new Orb.Moon();
    }
    return bodyPosition(moon, date, true, outputPosition, outputVelocity);
}

export function initializeSatellite(tle: TLE): SatelliteData {
    return new Orb.Satellite({
        name: tle.name,
        first_line: tle.line1,
        second_line: tle.line2,
    });
}

export function satellitePosition(date: Date, satellite: SatelliteData, outputPosition: Vector3, outputVelocity?: Vector3): void {
    return bodyPosition(satellite, date, false, outputPosition, outputVelocity);
}
