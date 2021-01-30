declare module 'satellite.js' {
    export interface SatRec {
        a: number;
        alta: number;
        altp: number;
    }
}

declare module 'satellite.js/lib/constants' {
    export const pi: number;
    export const deg2rad: number;
    export const tumin: number;
}

declare module 'satellite.js/lib/ext' {
    interface MDHMS {
        mon: number;
        day: number;
        hr: number;
        minute: number;
        sec: number;
    }
    export function days2mdhms(year: number, days: number): MDHMS;
    export function jday(year: number, mon: number, day: number, hr: number, minute: number, sec: number, msec?: number): number;
}

declare module 'satellite.js/lib/propagation/sgp4init' {
    import { SatRec } from 'satellite.js';

    interface SGP4InitOptions {
        opsmode: string;
        satn: string;
        epoch: number;
        xbstar: number;
        xecco: number;
        xargpo: number;
        xinclo: number;
        xmo: number;
        xno: number;
        xnodeo: number;
    }
    function sgp4init(satRec: SatRec, options: SGP4InitOptions): void;
    export default sgp4init;
}
