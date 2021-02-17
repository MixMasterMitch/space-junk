import { fetchTLEsAndParse } from './io';
import { startAnimation } from './animation';

const main = async (): Promise<void> => {
    console.log('Fetching and parsing TLEs...');
    const satRecs = await fetchTLEsAndParse();
    console.log('Satellite data loaded.');
    console.log(satRecs);
    const loadingContainer = document.getElementsByClassName('loading-container')[0];
    loadingContainer.className = loadingContainer.className.replace('fade-in', 'fade-out');
    await startAnimation();

    const nativeModule = await import('./native/pkg');
    console.log(nativeModule.main(0));
    console.log(nativeModule.main(1));
};

main().then(() => console.log);
