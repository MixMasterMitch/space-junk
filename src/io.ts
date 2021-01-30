import { Reader } from 'protobufjs';
import { SatRec } from 'satellite.js';
import { pi, deg2rad, tumin } from 'satellite.js/lib/constants';
import { days2mdhms, jday } from 'satellite.js/lib/ext';
import sgp4init from 'satellite.js/lib/propagation/sgp4init';

import { Satellites, ISatellite } from 'generated/protobuf';

/**
 * See https://github.com/shashwatak/satellite-js/blob/1e6c4f0d14de5abab0d52b91a27b70028a0a0221/src/io.js#L69
 */
export const parseSatRecTLE = (line1: string, line2: string): ISatellite => {
    const sr = {} as ISatellite;
    sr.satnum = line1.substring(2, 7);

    sr.epochyr = parseInt(line1.substring(18, 20), 10);
    sr.epochdays = parseFloat(line1.substring(20, 32));
    sr.ndot = parseFloat(line1.substring(33, 43));
    sr.nddot = parseFloat(`.${parseInt(line1.substring(44, 50), 10)}E${line1.substring(50, 52)}`);
    sr.bstar = parseFloat(`${line1.substring(53, 54)}.${parseInt(line1.substring(54, 59), 10)}E${line1.substring(59, 61)}`);

    sr.inclo = parseFloat(line2.substring(8, 16));
    sr.nodeo = parseFloat(line2.substring(17, 25));
    sr.ecco = parseFloat(`.${line2.substring(26, 33)}`);
    sr.argpo = parseFloat(line2.substring(34, 42));
    sr.mo = parseFloat(line2.substring(43, 51));
    sr.no = parseFloat(line2.substring(52, 63));
    return sr;
};

export const parseSatRecProtobufs = (buffer: Uint8Array): SatRec[] => {
    const opsmode = 'i';
    const xpdotp = 1440.0 / (2.0 * pi); // 229.1831180523293;

    const reader = Reader.create(buffer);
    const satRecs = Satellites.toObject(Satellites.decode(reader)).satellites;
    satRecs.forEach((sr: SatRec) => {
        sr.error = 0;
        sr.no /= xpdotp;
        sr.a = (sr.no * tumin) ** (-2.0 / 3.0);
        sr.ndot /= xpdotp * 1440.0;
        sr.nddot /= xpdotp * 1440.0 * 1440;
        sr.inclo *= deg2rad;
        sr.nodeo *= deg2rad;
        sr.argpo *= deg2rad;
        sr.mo *= deg2rad;
        sr.alta = sr.a * (1.0 + sr.ecco) - 1.0;
        sr.altp = sr.a * (1.0 - sr.ecco) - 1.0;
        const year = sr.epochyr < 57 ? sr.epochyr + 2000 : sr.epochyr + 1900;
        const { mon, day, hr, minute, sec } = days2mdhms(year, sr.epochdays);
        sr.jdsatepoch = jday(year, mon, day, hr, minute, sec);
        sgp4init(sr, {
            opsmode,
            satn: sr.satnum,
            epoch: sr.jdsatepoch - 2433281.5,
            xbstar: sr.bstar,
            xecco: sr.ecco,
            xargpo: sr.argpo,
            xinclo: sr.inclo,
            xmo: sr.mo,
            xno: sr.no,
            xnodeo: sr.nodeo,
        });
    });
    return satRecs;
};
