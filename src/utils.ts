import { J2000_EPOCH } from './constants';

/**
 * Determines what percentage of the way into the year a given date is at relative to the J200 epoch.
 *
 * This calculation does not account for precession because it would only make a difference of 0.2% over 60 years.
 */
export const getJ200YearPercentage = (date: Date): number => {
    // Take the J200 epoch and shift it to the current year
    const jx = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            J2000_EPOCH.getUTCMonth(),
            J2000_EPOCH.getUTCDate(),
            J2000_EPOCH.getUTCHours(),
            J2000_EPOCH.getUTCMinutes(),
            J2000_EPOCH.getUTCSeconds(),
            J2000_EPOCH.getUTCMilliseconds(),
        ),
    );

    // Determine the shifted J200 epoch before and after the given date.
    let yearStart: Date;
    let yearEnd: Date;
    if (jx.getTime() > date.getTime()) {
        yearStart = new Date(
            Date.UTC(
                date.getUTCFullYear() - 1,
                J2000_EPOCH.getUTCMonth(),
                J2000_EPOCH.getUTCDate(),
                J2000_EPOCH.getUTCHours(),
                J2000_EPOCH.getUTCMinutes(),
                J2000_EPOCH.getUTCSeconds(),
                J2000_EPOCH.getUTCMilliseconds(),
            ),
        );
        yearEnd = jx;
    } else {
        yearStart = jx;
        yearEnd = new Date(
            Date.UTC(
                date.getUTCFullYear() + 1,
                J2000_EPOCH.getUTCMonth(),
                J2000_EPOCH.getUTCDate(),
                J2000_EPOCH.getUTCHours(),
                J2000_EPOCH.getUTCMinutes(),
                J2000_EPOCH.getUTCSeconds(),
                J2000_EPOCH.getUTCMilliseconds(),
            ),
        );
    }

    // Determine what percentage of the way between the start and end of the year the current date is at.
    return (date.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime());
};
export const getJ200DayPercentage = (date: Date): number => {
    // Take the J200 epoch and shift it to the current year and day
    const jx = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            J2000_EPOCH.getUTCHours(),
            J2000_EPOCH.getUTCMinutes(),
            J2000_EPOCH.getUTCSeconds(),
            J2000_EPOCH.getUTCMilliseconds(),
        ),
    );

    // Determine the shifted J200 epoch before and after the given date.
    let dayStart: Date;
    let dayEnd: Date;
    if (jx.getTime() > date.getTime()) {
        dayStart = new Date(
            Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate() - 1,
                J2000_EPOCH.getUTCHours(),
                J2000_EPOCH.getUTCMinutes(),
                J2000_EPOCH.getUTCSeconds(),
                J2000_EPOCH.getUTCMilliseconds(),
            ),
        );
        dayEnd = jx;
    } else {
        dayStart = jx;
        dayEnd = new Date(
            Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate() + 1,
                J2000_EPOCH.getUTCHours(),
                J2000_EPOCH.getUTCMinutes(),
                J2000_EPOCH.getUTCSeconds(),
                J2000_EPOCH.getUTCMilliseconds(),
            ),
        );
    }

    // Determine what percentage of the way between the start and end of the day the current date is at.
    return (date.getTime() - dayStart.getTime()) / (dayEnd.getTime() - dayStart.getTime());
};

export const percentageToRadians = (percentage: number): number => {
    return percentage * 2 * Math.PI;
};
