import { WebSocketConnection } from './connection/WebSocketConnection';

export type OnUpgradeCallback = (socket: WebSocketConnection) => void;
