import EventEmitter from 'events';
import { Duplex } from 'stream';
import { FrameNotMaskedException } from './exceptions';
import { OPCODES } from './constants';

export enum WsConnectionState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
}

export class WebSocketConnection extends EventEmitter {
  socket!: Duplex;
  state: WsConnectionState = WsConnectionState.CONNECTING;

  constructor({ socket }: { socket: Duplex }) {
    super();
    this.socket = socket;

    socket.on('data', (data: Buffer) => {
      console.log(`receiving data: ${data.toString('hex')}`);
      this.parseFrame(data);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  parseFrame(data: Buffer) {
    // Process first byte
    // 0:[FIN] 1..3:[reserved] 4..7:[opcode]
    const firstByte = data.readUint8(0);
    const opcode = firstByte & 0b00001111;

    if (opcode === OPCODES.close) {
      this.socket.end();
      return;
    }
    const entry = Object.values(OPCODES).find((_, value) => (
      value === opcode
    ));

    // Process second byte
    // 0:[MASK] 1..7:[Payload len]
    const secondByte = data.readUint8(1);
    const masked = (secondByte & 0b10000000) >> 7;

    if (!masked) {
      throw new FrameNotMaskedException();
    }

    const len = secondByte & 0b01111111;
    // eslint-disable-next-line no-nested-ternary
    const effectiveLen = len <= 125 ? len : (
      len === 126 ? data.readUint16BE(2) : data.readUint32BE(2)
    );

    console.log({ firstByte, opcode: entry ?? 'invalid' });
  }
}

/**
 * Wire format defined in <https://www.rfc-editor.org/rfc/rfc6455#section-5.2>
 *
 *   0                   1                   2                   3
 *   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *  +-+-+-+-+-------+-+-------------+-------------------------------+
 *  |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
 *  |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 *  |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 *  | |1|2|3|       |K|             |                               |
 *  +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 *  |     Extended payload length continued, if payload len == 127  |
 *  + - - - - - - - - - - - - - - - +-------------------------------+
 *  |                               |Masking-key, if MASK set to 1  |
 *  +-------------------------------+-------------------------------+
 *  | Masking-key (continued)       |          Payload Data         |
 *  +-------------------------------- - - - - - - - - - - - - - - - +
 *  :                     Payload Data continued ...                :
 *  + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 *  |                     Payload Data continued ...                |
 *  +---------------------------------------------------------------+
 */
