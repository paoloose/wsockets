// Defined here <https://www.rfc-editor.org/rfc/rfc6455#page-29>
export const OPCODES = Object.freeze({
  continuation: 0x00,
  text: 0x01,
  binary: 0x02,
  // 3...7 are reserved
  close: 0x08,
  ping: 0x09,
  pong: 0x0A,
  // B...F are reserved
});

export const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
