import { fetchTLEsAndParse } from './io';

const main = async (): Promise<void> => {
    console.log('Fetching and parsing TLEs...');
    const satRecs = await fetchTLEsAndParse();
    console.log('Satellite data loaded.');
    console.log(satRecs);
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');
};

main().then(() => console.log);
