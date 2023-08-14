import http from 'node:http';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { Duplex } from 'node:stream';
import {
  BAD_REQUEST, UPGRADE_REQUIRED, METHOD_NOT_ALLOWED, SERVICE_UNAVAILABLE,
} from 'http-status';
import { WebSocketConnection } from '../connection/WebSocketConnection';
import { OnUpgradeCallback } from '../types';
import { GUID } from '../constants';

// References
// <https://rafalgolarz.com/blog/2016/12/07/websocket_servers_101/>
// <https://betterprogramming.pub/implementing-a-websocket-server-from-scratch-in-node-js-a1360e00a95f>
// <https://www.rfc-editor.org/rfc/rfc6455#section-1.1>

type WebSocketServerOptions = {
  /** @default false */
  noServer?: boolean,
  /** @default null */
  server?: http.Server | null
};

export enum ServerState {
  RUNNING,
  CLOSING,
  CLOSED,
}

const defaultOptions: WebSocketServerOptions = {
  noServer: false,
  server: null,
} as const;

export class WebSocketServer extends EventEmitter {
  private server: http.Server | null;
  private state: ServerState = ServerState.CLOSED;
  private options!: WebSocketServerOptions;

  constructor(options: WebSocketServerOptions = defaultOptions) {
    super();
    if (options.noServer) {
      this.server = null;
      return;
    }
    if (options.server && options.server !== null) {
      this.server = options.server;
    }
    else {
      // Connections without the 'Connection' header set to 'Upgrade' end up here
      this.server = http.createServer((_req, res) => {
        const body = http.STATUS_CODES[UPGRADE_REQUIRED]!;
        res.writeHead(UPGRADE_REQUIRED, {
          'content-type': 'text/plain',
          'upgrade': 'WebSocket',
          'content-length': Buffer.byteLength(body),
        });
        res.end(body);
      });
      // All ws handshake request will be handled by the server.on('upgrade') callback
    }

    // Register the necessary events on the http server
    this.server.on('upgrade', (req, socket, head) => {
      this.emit('headers', req.headers);

      // Discard the socket on bad request
      this.handleUpgrade(req, socket, head, (ws) => {
        this.emit('connection', ws, req);
      });
    });
    this.server.on('error', this.emit.bind(this, 'error'));
    this.server.on('listening', () => {
      this.emit.bind(this, 'listening');
      this.state = ServerState.RUNNING;
    });

    // TODO: client tracking?
    // <https://github.com/websockets/ws/blob/0b235e0f9b650b1bdcbdb974cbeaaaa6a0797855/lib/websocket-server.js#L126>
    this.options = options;
  }

  public listen(port: number | string, cb?: () => void) {
    if (!this.server) {
      throw new Error('Cannot listen on a serverless WebSocketServer');
    }
    this.server.listen(port, cb || (() => { }));
  }

  public handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    _head: Buffer,
    cb: OnUpgradeCallback,
  ) {
    if (req.method !== 'GET') {
      this.abortSocketHandshakeOrEmitWsClientError(socket, req, METHOD_NOT_ALLOWED, 'Method must be GET');
      return;
    }
    if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
      this.abortSocketHandshakeOrEmitWsClientError(socket, req, BAD_REQUEST, 'Missing or invalid \'upgrade\' header');
      return;
    }

    const secWebsocketKey = req.headers['sec-websocket-key'];
    const secWebsocketVersion = Number(req.headers['sec-websocket-version']);
    // MISSING: protocol and extensions as defined in https://www.rfc-editor.org/rfc/rfc6455#section-4.2.2
    // const secWebSocketProtocol = req.headers['sec-websocket-protocol'];
    // const secWebSocketExtensions = req.headers['sec-websocket-extensions'];

    if (secWebsocketKey?.length !== 24) {
      this.abortSocketHandshakeOrEmitWsClientError(socket, req, BAD_REQUEST, 'Missing or invalid \'sec-websocket-key\' header');
      return;
    }
    // NOTE: allow only version 13? <https://www.rfc-editor.org/rfc/rfc6455#section-4.2.1>
    if (secWebsocketVersion !== 8 && secWebsocketVersion !== 13) {
      this.abortSocketHandshakeOrEmitWsClientError(socket, req, BAD_REQUEST, 'Missing or invalid \'sec-websocket-version\' header');
      return;
    }

    this.completeUpgrade(req, secWebsocketKey, socket, cb);
  }

  // eslint-disable-next-line class-methods-use-this
  private completeUpgrade(
    _req: http.IncomingMessage,
    acceptKey: string,
    socket: Duplex,
    cb: OnUpgradeCallback,
  ) {
    if (this.state !== ServerState.RUNNING) {
      WebSocketServer.abortSocketHandshake(socket, SERVICE_UNAVAILABLE);
    }
    socket.on('error', WebSocketServer.onSocketError);
    const acceptValue = createHash('sha1')
      .update(acceptKey + GUID, 'binary')
      .digest('base64');

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'upgrade: websocket',
      'connection: Upgrade',
      `sec-websocket-accept: ${acceptValue}`,
    ];
    // MISSING: return appropiate responses to extensions and protocols

    socket.write(`${response.join('\r\n')}\r\n\r\n`);

    const client = new WebSocketConnection({ socket });
    cb(client);
  }

  // socket 'error' events sent by the net module
  private static onSocketError(socket: Duplex) {
    socket.destroy();
  }

  private abortSocketHandshakeOrEmitWsClientError(
    socket: Duplex,
    req: http.IncomingMessage,
    status: number,
    message: string,
  ) {
    // if any is listening to this error, then it is responsible for handling it
    // and closing the socket. No http.ServerResponse is returned so the listener should write
    // the HTTP response directly to the socket
    if (this.listenerCount('ws:client-error') > 0) {
      const err = new Error(message);
      Error.captureStackTrace(err, this.abortSocketHandshakeOrEmitWsClientError);
      this.emit('ws:client-error', err, socket, req);
    }
    else {
      WebSocketServer.abortSocketHandshake(socket, status, message);
    }
  }

  private static abortSocketHandshake(socket: Duplex, status: number, message?: string) {
    const body = message ?? http.STATUS_CODES[status] ?? '';
    const response = [
      `HTTP/1.1 ${status} ${http.STATUS_CODES[status]}`,
      'connection: close',
      'content-type: text/html',
      `content-length: ${Buffer.byteLength(body)}`,
    ];
    socket.once('finish', socket.destroy);
    socket.end(`${response.join('\r\n')}\r\n\r\n${body}`);
  }
}
