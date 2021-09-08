import { fetchTLEsAndParse } from './io';
import { startAnimation } from './animation';
import { log } from './utils';
import {EciVec3, propagate, SatRec} from "satellite.js";
import {Vector3} from "three";

const main = async (): Promise<void> => {
    log('Fetching and parsing TLEs...');
    // const satRecs = await fetchTLEsAndParse();
    log('Satellite data loaded.');
    await startAnimation();
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');

    const nativeModule = await import('./native/pkg');
    log(nativeModule.main(0));
    log(nativeModule.main(1));
};

main().then(() => log);
