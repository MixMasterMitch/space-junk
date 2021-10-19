import * as React from 'react';
import { findDOMNode, render } from 'react-dom';
import {CSSProperties, FunctionComponent, useEffect, useRef, useState} from 'react';
import Timeout = NodeJS.Timeout;
import { log } from './utils';
import { WebGLRenderer } from 'three';
import {DefaultEventMap, EventEmitter} from 'tsee';

const START_DATE = new Date('1959-01-01T00:00:00.000Z');
const END_DATE = new Date();
const END_DATE_YEAR_END = new Date(Date.UTC(END_DATE.getUTCFullYear() + 1, 0, 1));
const NUM_YEARS = END_DATE_YEAR_END.getUTCFullYear() - START_DATE.getUTCFullYear();
const NUM_MILLIS = END_DATE_YEAR_END.getTime() - START_DATE.getTime();

const titleStyle: CSSProperties = {
    margin: 0,
    padding: 'calc(2% + 1rem)',
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

const dateContainerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    top: 0,
};

const dateMarkerStyle: CSSProperties = {
    borderLeft: '1px solid gray',
    height: '2rem',
};

export interface UIEvents extends DefaultEventMap {
    dateTick: (date: Date) => void;
}

interface UIProps {
    eventBus: EventEmitter<UIEvents>;
}
const UI: FunctionComponent<UIProps> = ({ eventBus }) => {
    const timelineElement = useRef<HTMLDivElement>(null);
    const [currentDate, setCurrentDate] = useState<Date>();
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    useEffect(() => {
        eventBus.addListener('dateTick', (date) => {
            setCurrentDate(date);
        });
    });

    let dateTime = END_DATE.getTime();
    if (hoverDate !== null) {
        dateTime = hoverDate.getTime();
    } else if (currentDate !== undefined) {
        dateTime = currentDate.getTime();
    }
    const percent = (dateTime - START_DATE.getTime()) / NUM_MILLIS;
    let offset = 0;
    if (timelineElement.current !== null) {
        offset = timelineElement.current.offsetWidth * percent;
    }
    log(offset);

    const yearMarkers = [];
    const yearLabels = [];
    for (let i = 0; i < NUM_YEARS; i++) {
        const year = START_DATE.getUTCFullYear() + i;
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
            <div
                style={timelineContainerStyle}
                ref={timelineElement}
                onMouseLeave={() => setHoverDate(null)}
                onMouseMove={(e) => {
                    if (timelineElement.current !== null) {
                        const element = findDOMNode(timelineElement.current) as Element;
                        const clickPosition = e.nativeEvent.clientX;
                        const elementEdgePosition = element.getBoundingClientRect().x;
                        const elementWidth = timelineElement.current.offsetWidth;
                        const percent = Math.max(0, Math.min(1, (clickPosition - elementEdgePosition) / elementWidth));
                        const date = new Date(Math.min(START_DATE.getTime() + NUM_MILLIS * percent, END_DATE.getTime()));
                        setHoverDate(date);
                    }
                }}
            >
                <div style={timelineMarkersContainerStyle}>{yearMarkers}</div>
                <div style={timelineLabelsContainerStyle}>{yearLabels}</div>
                <div style={{ ...dateContainerStyle, left: `${offset}px` }}>
                    <div style={dateMarkerStyle} />
                </div>
            </div>
        </div>
    );
};

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
