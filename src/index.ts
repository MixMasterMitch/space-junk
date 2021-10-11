import { startAnimation } from './animation';
import { log } from './utils';
// import { propagate, twoline2satrec } from 'satellite.js';
// import { Vector3 } from 'three';
// import { initializeSatellite, satellitePosition } from './orb';
import SatellitesData from './SatellitesData';

const main = async (): Promise<void> => {
    log('Fetching and parsing TLEs...');
    const satellites = await SatellitesData.loadRemoteSatellites();
    log('SatellitePositionState data loaded.');
    await startAnimation(satellites);
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');

    // const date = new Date();

    // const nativeModule = await import('./native/pkg');
    // const output = nativeModule.create_vector_array();
    // nativeModule.propagate(0, date.getTime(), output);
    //
    // const tle = {
    //     name: 'ISS',
    //     line1: `1 25544U 98067A   21245.53748218  .00003969  00000-0  81292-4 0  9995`,
    //     line2: `2 25544  51.6442 320.2331 0003041 346.4163 145.5195 15.48587491300581`,
    // };
    //
    // const satellite = initializeSatellite(tle);
    // const output2 = new Vector3();
    // satellitePosition(date, satellite, output2);
    //
    // const satrec = twoline2satrec(tle.line1, tle.line2);
    // const output3 = propagate(satrec, date) as any;
};

main().then(() => log);
