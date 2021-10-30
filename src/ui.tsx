import * as React from 'react';
import { findDOMNode, render } from 'react-dom';
import { CSSProperties, FunctionComponent, RefObject, useEffect, useRef, useState } from 'react';
import Timeout = NodeJS.Timeout;
import { log } from './utils';
import { WebGLRenderer } from 'three';
import { DefaultEventMap, EventEmitter } from 'tsee';
import { DateTime, Duration, Interval } from 'luxon';
import { SatelliteStats } from './animation/Satellites';

const START_DATE = DateTime.fromISO('1959-01-01T00:00:00.000Z').toUTC();
const END_DATE = DateTime.utc();
const TIMELINE_INTERVAL = Interval.fromDateTimes(START_DATE, END_DATE.endOf('year'));
const TIMELINE_NUM_YEARS = Math.ceil(TIMELINE_INTERVAL.length('years'));
const TIMELINE_NUM_MILLIS = TIMELINE_INTERVAL.length('milliseconds');

const titleStyle: CSSProperties = {
    margin: 0,
    padding: 'calc(2% + 1rem)',
    paddingBottom: 0,
};

const statsStyle: CSSProperties = {
    pointerEvents: 'auto',
    padding: '1rem calc(2% + 1rem)',
    lineHeight: '1.3',
};

const timelineContainerStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    margin: 'calc(2% + 1rem)',
    width: 'calc(100% - 4% - 2rem)',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    cursor: 'default',
    paddingTop: '1rem',
};

const timelineMarkersContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
};

const timelineLabelsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: '1rem',
};

const yearMarkerContainerStyle: CSSProperties = {
    flex: 1,
    borderLeft: '1px solid white',
};
const yearLabelStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    width: 0,
};
const yearLabelInnerStyle: CSSProperties = {
    position: 'absolute',
    width: '100%',
    marginLeft: '-50%',
    display: 'flex',
    justifyContent: 'center',
};

const dateMarkerContainerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    top: 0,
};

const dateMarkerStyle: CSSProperties = {
    borderLeft: '1px solid gray',
    height: '2rem',
};

const dateContainerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    top: '-1.5rem',
};

export interface UIEvents extends DefaultEventMap {
    dateTick: (date: DateTime) => void;
    dateReset: (date: DateTime) => void;
    satelliteStatsUpdate: (stats: SatelliteStats) => void;
}

interface UIProps {
    eventBus: EventEmitter<UIEvents>;
}
const UI: FunctionComponent<UIProps> = ({ eventBus }) => {
    const timelineElement = useRef<HTMLDivElement>(null);
    const dateElement = useRef<HTMLDivElement>(null);
    const [currentDate, setCurrentDateTime] = useState<DateTime>();
    const [hoverDateTime, setHoverDateTime] = useState<DateTime | null>(null);
    const [satelliteStats, setSatelliteStats] = useState<SatelliteStats>({
        large: 0,
        medium: 0,
        small: 0,
        payload: 0,
        rocketBody: 0,
        debris: 0,
        starlink: 0,
        leo: 0,
        geo: 0,
        total: 0,
    });
    const [hoverStats, setHoverStats] = useState<boolean>(false);
    useEffect(() => {
        eventBus.addListener('dateTick', (date) => {
            setCurrentDateTime(date);
        });
        eventBus.addListener('satelliteStatsUpdate', (stats) => {
            setSatelliteStats(stats);
        });
    });

    let dateTime = END_DATE;
    if (hoverDateTime !== null) {
        dateTime = hoverDateTime;
    } else if (currentDate !== undefined) {
        dateTime = currentDate;
    }
    const percent = dateTime.diff(START_DATE).toMillis() / TIMELINE_NUM_MILLIS;
    let dateMarkerOffset = 0;
    if (timelineElement.current !== null) {
        dateMarkerOffset = timelineElement.current.offsetWidth * percent;
    }

    const { width: timelineWidth } = getElementWidthAndOffset(timelineElement);
    const { width: dateWidth } = getElementWidthAndOffset(dateElement);
    const dateOffset = Math.max(0, Math.min(dateMarkerOffset - dateWidth / 2, timelineWidth - dateWidth));
    // log(offset);

    const yearMarkers = [];
    const yearLabels = [];
    for (let i = 0; i < TIMELINE_NUM_YEARS; i++) {
        const year = START_DATE.year + i;
        const isNewDecade = year % 10 === 0;
        yearMarkers.push(<div key={i} style={{ ...yearMarkerContainerStyle, height: isNewDecade ? '1rem' : '0.5rem' }} />);
        yearLabels.push(
            <div key={i} style={yearLabelStyle}>
                <div style={yearLabelInnerStyle}>{isNewDecade ? year : ''}</div>
            </div>,
        );
    }
    return (
        <div>
            <h1 style={titleStyle}>Space Junk</h1>
            <div style={statsStyle} onMouseEnter={() => setHoverStats(true)} onMouseLeave={() => setHoverStats(false)}>
                <div>Number of satellites displayed: {satelliteStats.total}</div>
                {hoverStats ? (
                    <>
                        <div>
                            Large satellites ({'>'}1 m<sup>2</sup> cross-section): {satelliteStats.large}
                        </div>
                        <div>
                            Medium satellites (.1 m<sup>2</sup> - 1 m<sup>2</sup> cross-section): {satelliteStats.medium}
                        </div>
                        <div>
                            Small satellites ({'<'}.1 m<sup>2</sup> cross-section): {satelliteStats.small}
                        </div>
                        <div>Payload satellites: {satelliteStats.payload}</div>
                        <div>Rocket bodies: {satelliteStats.rocketBody}</div>
                        <div>Debris satellites: {satelliteStats.debris}</div>
                        <div>Starlink satellites: {satelliteStats.starlink}</div>
                        <div>
                            Low Earth orbit satellites ({'<'} 3,000 km altitude): {satelliteStats.leo}
                        </div>
                        <div>
                            Geosynchronous orbit satellites (35,786 km altitude): {satelliteStats.geo}
                        </div>
                    </>
                ) : null}
            </div>
            <div
                style={timelineContainerStyle}
                ref={timelineElement}
                onMouseLeave={() => setHoverDateTime(null)}
                onMouseMove={(e) => {
                    if (timelineElement.current !== null) {
                        const clickPosition = e.nativeEvent.clientX;
                        const { width: elementWidth, offset: elementEdgePosition } = getElementWidthAndOffset(timelineElement);
                        const percent = Math.max(0, Math.min(1, (clickPosition - elementEdgePosition) / elementWidth));
                        const duration = Duration.fromMillis(TIMELINE_NUM_MILLIS * percent);
                        const newDateTime = DateTime.min(START_DATE.plus(duration), END_DATE);
                        setHoverDateTime(newDateTime);
                    }
                }}
                onClick={() => eventBus.emit('dateReset', dateTime)}
            >
                <div style={timelineMarkersContainerStyle}>{yearMarkers}</div>
                <div style={timelineLabelsContainerStyle}>{yearLabels}</div>
                <div style={{ ...dateMarkerContainerStyle, left: `${dateMarkerOffset}px` }}>
                    <div style={dateMarkerStyle} />
                </div>
                <div style={{ ...dateContainerStyle, left: `${dateOffset}px` }}>
                    <div ref={dateElement}>{dateTime.toFormat('hh:mm a MMM dd, yyyy')}</div>
                </div>
            </div>
        </div>
    );
};

function getElementWidthAndOffset(ref: RefObject<HTMLDivElement>): { width: number; offset: number } {
    if (ref.current === null) {
        return { width: 0, offset: 0 };
    }
    const element = findDOMNode(ref.current) as Element;
    return { width: ref.current.offsetWidth, offset: element.getBoundingClientRect().x };
}

export const uiEventBus = new EventEmitter<UIEvents>();

export function startUI(renderer: WebGLRenderer): EventEmitter<UIEvents> {
    const rootElement = document.getElementById('react-root') as HTMLElement;

    let hideUITimeout: Timeout;
    const handleMouseMove = () => {
        renderer.domElement.className = renderer.domElement.className.replace('hide-cursor', 'show-cursor');
        rootElement.className = 'fade-in';
        clearTimeout(hideUITimeout);
        hideUITimeout = setTimeout(() => {
            renderer.domElement.className = renderer.domElement.className.replace('show-cursor', 'hide-cursor');
            rootElement.className = 'fade-out';
        }, 3000);
    };
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    rootElement.addEventListener('mousemove', handleMouseMove);

    render(<UI eventBus={uiEventBus} />, rootElement);
    return uiEventBus;
}
