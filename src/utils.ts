import { J2000_EPOCH } from './constants';
import { Vector3 } from 'three';
import { EciVec3, Kilometer, SatRec, propagate as propagateInKm, KilometerPerSecond } from 'satellite.js';

export const getJ200PeriodPercentage = (date: Date, periodMs: number): number => {
    const elapsedTime = date.getTime() - J2000_EPOCH.getTime();
    const elapsedSiderealDays = elapsedTime / periodMs;
    return getDecimalComponent(elapsedSiderealDays);
};

export const getDecimalComponent = (n: number): number => {
    return n - Math.trunc(n);
};

export const percentageToRadians = (percentage: number): number => {
    return percentage * 2 * Math.PI;
};

export const kmToModelUnits = (km: number): number => {
    return km / 1000;
};

export const kmPerSecondToModelUnits = (kmPerSecond: number): number => {
    return kmPerSecond / 1000 / 1000;
};

export const getDayOfYear = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};

/**
 * returns position in model units and velocity in model units per second
 */
export const propagate = (satrec: SatRec, date: Date): { position: Vector3; velocity: Vector3 } => {
    const data = propagateInKm(satrec, date);
    // TODO: handle false values
    const positionEci = data.position as EciVec3<Kilometer>;
    const velocityEci = data.velocity as EciVec3<KilometerPerSecond>;
    return {
        // position: new Vector3(kmToModelUnits(positionEci.x), kmToModelUnits(positionEci.y), kmToModelUnits(positionEci.z)),
        position: new Vector3(-kmToModelUnits(positionEci.y), kmToModelUnits(positionEci.z), -kmToModelUnits(positionEci.x)),
        velocity: new Vector3(-kmToModelUnits(velocityEci.y), kmToModelUnits(velocityEci.z), -kmToModelUnits(velocityEci.x)),
    };
};

// See https://gist.github.com/bgrins/5108712
export const log = (function () {
    return Function.prototype.bind.call(console.log, console);
})();
console.log = () => {
    // no op
};
