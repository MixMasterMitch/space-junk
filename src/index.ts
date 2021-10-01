import { fetchTLEsAndParse } from './io';
import { startAnimation } from './animation';
import { log } from './utils';
import {EciVec3, propagate, SatRec, twoline2satrec} from "satellite.js";
import {Vector3} from "three";
import {initializeSatellite, satellitePosition} from "./orb";

const main = async (): Promise<void> => {
    log('Fetching and parsing TLEs...');
    // const satRecs = await fetchTLEsAndParse();
    log('Satellite data loaded.');
    await startAnimation();
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');

    const nativeModule = await import('./native/pkg');
    const output = nativeModule.create_vector_array();
    const date = new Date();
    nativeModule.propagate(0, date.getTime(), output);
    log(output[0]);
    log(output[1]);
    log(output[2]);
    const tle = {
        name: 'ISS',
        line1: `1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995`,
        line2: `2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581`,
    };
    const satellite = initializeSatellite(tle);
    const output2 = new Vector3();
    satellitePosition(date, satellite, output2);
    log(output2.x);
    log(output2.y);
    log(output2.z);
    const satrec = twoline2satrec(tle.line1, tle.line2);
    const output3 = propagate(satrec, date) as any;
    log(output3.position.x / 1000);
    log(output3.position.y / 1000);
    log(output3.position.z / 1000);
};

main().then(() => log);
