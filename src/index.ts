import { Settings } from 'luxon';

Settings.defaultZone = 'UTC';

import { startAnimation } from './animation';
import { log } from './utils';
import SatellitesData from './SatellitesData';
import { startUI, uiEventBus } from './ui';

const main = async (): Promise<void> => {
    log('Fetching and parsing satellite data...');
    const satellites = await SatellitesData.loadRemoteSatellites();
    log('Satellite data loaded.');
    log('Initializing graphics...');
    const renderer = await startAnimation(satellites, uiEventBus);
    log('Graphics initialized.');
    log('Initializing UI...');
    startUI(renderer);
    log('Initialized UI');
    log('App ready.');
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');
};

main().then(() => log);
