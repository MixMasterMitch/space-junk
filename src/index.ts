import { fetchTLEsAndParse } from './io';
import { startAnimation } from './animation';
import {getJ200YearPercentage} from "./utils";

const main = async (): Promise<void> => {
    console.log(getJ200YearPercentage(new Date()));
    console.log(getJ200YearPercentage(new Date('2021-01-01T00:00:00.000Z')));
    console.log('Fetching and parsing TLEs...');
    const satRecs = await fetchTLEsAndParse();
    console.log('Satellite data loaded.');
    console.log(satRecs);
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');
    await startAnimation();
};

main().then(() => console.log);
