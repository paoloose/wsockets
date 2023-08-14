# wsockets

WebSockets server implementation for Node.js following the [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455): The WebSocket Protocol.

## Missing features

### For being RFC 6455 compliant

- [ ] Subprotocol handling (optional `sec-websocket-protocol` header) as
      defined in [RFC 6544 4.2.2](https://www.rfc-editor.org/rfc/rfc6455#section-4.2.2).
- [ ] Extensions handling (optional `sec-websocket-extensions` header) as
      defined in [RFC 6544 4.2.2](https://www.rfc-editor.org/rfc/rfc6455#section-4.2.2).

### To improve the API

- [ ] Client authentication interface (maybe implemented as a middleware for the
      user).
- [ ] Interface for passing the socket connection to another server as in the
      [example here](https://www.rfc-editor.org/rfc/rfc6455#section-4.2).
- [ ] Fallback to long-polling when the web socket connection can't be established
      (as in [socket.io](https://socket.io/docs/v4/engine-io-protocol/)).
