import { SatRec, twoline2satrec } from 'satellite.js';
import { parse } from 'papaparse';

interface TLE {
    objectName: string;
    objectType: 'DEBRIS' | 'PAYLOAD' | 'ROCKET BODY' | 'TBA';
    rcsSize?: 'SMALL' | 'MEDIUM' | 'LARGE';
    countryCode: string;
    site: string;
    launchDate: string;
    decayDate: string;
    tleLine1: string;
    tleLine2: string;
}

export const fetchTLEsAndParse = async (): Promise<SatRec[]> => {
    return new Promise((resolve, reject) => {
        const satRecs: SatRec[] = [];
        parse(`${window.location.protocol}//${window.location.host}/resources/tle.csv`, {
            header: true,
            download: true,
            delimiter: ',',
            step: (row) => {
                const tle: TLE = row.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                const satrec = twoline2satrec(tle.tleLine1, tle.tleLine2);
                satrec.objectName = tle.objectName;
                satrec.objectType = tle.objectType;
                satrec.rcsSize = tle.rcsSize || 'MEDIUM';
                satrec.countryCode = tle.countryCode;
                satrec.site = tle.site;
                satrec.launchDate = dateFromDayString(tle.launchDate);
                satrec.decayDate = tle.decayDate ? dateFromDayString(tle.decayDate) : undefined;
                satRecs.push(satrec);
            },
            complete: () => {
                resolve(satRecs);
            },
            error: reject,
        });
    });
};

/**
 * Expects an input in the form of "MM/DD/YY" where a year < 58 is in the 2000's and a year >=58 is in the 1900's.
 * For example "01/22/11" = January 22nd, 2011 and "03/10/60" = March 10th, 1960
 * Time is midnight UTC on the given date.
 */
const dateFromDayString = (str: string): Date => {
    const parts = str.split('/');
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);
    const yearPart = parseInt(parts[2]);
    const year = yearPart < 58 ? yearPart + 2000 : yearPart + 1900;
    return new Date(Date.UTC(year, month - 1, day));
};
