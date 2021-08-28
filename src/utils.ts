import { J2000_EPOCH, SIDEREAL_DAY_MS, SIDEREAL_YEAR_MS } from './constants';

/**
 * Determines what percentage of the way around the sun that Earth is at a given date. Based on the J200 epoch.
 */
export const getJ200SiderealYearPercentage = (date: Date): number => {
    const elapsedTime = date.getTime() - J2000_EPOCH.getTime();
    const elapsedSiderealYears = elapsedTime / SIDEREAL_YEAR_MS;
    return getDecimalComponent(elapsedSiderealYears);
};
/**
 * Determines what percentage of a rotation about its access that Earth has rotated on a given date. Based on the J200 epoch.
 */
export const getJ200SiderealDayPercentage = (date: Date): number => {
    const elapsedTime = date.getTime() - J2000_EPOCH.getTime();
    const elapsedSiderealDays = elapsedTime / SIDEREAL_DAY_MS;
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
