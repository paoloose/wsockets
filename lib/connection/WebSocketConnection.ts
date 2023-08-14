import EventEmitter from 'events';
import { Duplex } from 'stream';
// import { FrameNotMaskedException } from '../exceptions';
// import { OPCODES } from '../constants';
import { DataReceiver } from './DataReceiver';
import { DataSender } from './DataSender';

export enum WsConnectionState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
}

export class WebSocketConnection extends EventEmitter {
  socket!: Duplex;
  state!: WsConnectionState;
  paused!: boolean;
  receiver!: DataReceiver;
  sender!: DataSender;

  constructor({ socket }: { socket: Duplex }) {
    super();
    this.socket = socket;
    this.state = WsConnectionState.CONNECTING;
    this.paused = false;

    this.init();
  }

  init() {
    this.sender = new DataSender();
    this.receiver = new DataReceiver();

    // listen for events in the receiver
    // this.receiver.on('conclude', () => {});
    // this.receiver.on('drain', () => {});
    // this.receiver.on('error', () => {});
    // this.receiver.on('message', () => {});
    // this.receiver.on('ping', () => {});
    // this.receiver.on('pong', () => {});

    // listen for e vents in the socket itself
    // this.socket.on('close', () => {});
    // this.socket.on('data', () => {});
    // this.socket.on('end', () => {});
    // this.socket.on('error', () => {});

    this.socket.on('data', (data: Buffer) => {
      this.receiver.write(data);
    });
  }

  send(data: Buffer | string) {
    this.sender.send(data);
  }
}

/**
 * Wire format defined in <https://www.rfc-editor.org/rfc/rfc6455#section-5.2>
 *
 *   0                   1                   2                   3
 *   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *  +-+-+-+-+-------+-+-------------+-------------------------------+
 *  |F|R|R|R|opcode |M| Payload len |    Extended payload length    |
 *  |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 *  |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 *  | |1|2|3|       |K|             |                               |
 *  +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 *  |    Extended payload length continued, if payload len == 127   |
 *  + - - - - - - - - - - - - - - - +-------------------------------+
 *  |                               | Masking-key, if MASK set to 1 |
 *  +-------------------------------+-------------------------------+
 *  |    Masking-key (continued)    |          Payload Data         |
 *  +-------------------------------- - - - - - - - - - - - - - - - +
 *  :                     Payload Data continued ...                :
 *  + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 *  |                     Payload Data continued ...                |
 *  +---------------------------------------------------------------+
 */
