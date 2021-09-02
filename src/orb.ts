import { Vector3 } from 'three';
import { kmToModelUnits } from './utils';

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

declare const Orb: {
    Moon: MoonConstructor;
    Sun: SunConstructor;
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
