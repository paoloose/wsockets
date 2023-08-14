import { WebSocketConnection } from './websocket';

export type OnUpgradeCallback = (socket: WebSocketConnection) => void;
