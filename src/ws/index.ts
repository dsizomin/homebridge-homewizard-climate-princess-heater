import WebSocket from 'ws';
import {HelloWsOutgoingMessage, WsIncomingMessage, WsOutgoingMessage} from './types';
import {MessageType, WS_URL} from './const';
import {EventEmitter} from 'events';
import {Logger} from 'homebridge';

const TIMEOUT = 60 * 1000; // 1 minute

export class WsAPIClient extends EventEmitter {

  private lastMessageId = 0;

  private ws: WebSocket | null = null;

  constructor(
    private readonly log: Logger,
    private readonly token: string,
  ) {
    super();
  }

  public async send<M extends WsOutgoingMessage>(
    message: Omit<M, 'message_id'>,
  ): Promise<M> {

    const ws = await this._getWebSocket();
    return this._send<M>(message, ws);
  }

  private _getWebSocket(): Promise<WebSocket> {
    return new Promise((res, rej) => {
      if (
        !this.ws ||
        this.ws.readyState === WebSocket.CLOSING ||
        this.ws.readyState === WebSocket.CLOSED
      ) {

        this.log.warn('WS connection is not initialized or closed. Attempting to reopen');

        this.
          _open()
          .then(ws => this._handshake(ws))
          .then(ws => {
            this.ws = ws;
            res(ws);
          })
          .catch(err => rej(err));
      } else {
        return res(this.ws);
      }
    });
  }

  private _open(): Promise<WebSocket> {
    return new Promise((res, rej) => {
      this.log.debug('Opening WS connection to ->', WS_URL);
      const ws = new WebSocket(WS_URL);

      ws.on('message', (message: string) => {
        const json = JSON.parse(message);
        this.log.debug('Incoming message:', json);
        this.emit('message', json);
      });

      ws.on('error', (error) => {
        this.log.error('Unexpected error in WS connection ->', error);
      });

      ws.on('close', () => {
        this.log.debug('Closing WS connection to ->', WS_URL);
      });

      const openTimeout = setTimeout(() => {
        rej(new Error(`WS connection was not ready in ${TIMEOUT}ms`));
      }, TIMEOUT);

      ws.on('open', () => {
        clearTimeout(openTimeout);
        this.log.debug('Opened WS connection to ->', WS_URL);
        res(ws);
      });
    });
  }

  private _handshake(ws: WebSocket): Promise<WebSocket> {
    return this._send<HelloWsOutgoingMessage>({
      type: MessageType.Hello,
      version: '2.4.0',
      os: 'ios',
      source: 'climate',
      compatibility: 3,
      token: this.token,
    }, ws).then(() => {
      this.log.debug('WS handshake successful');
      return ws;
    });
  }

  private async _send<M extends WsOutgoingMessage>(
    message: Omit<M, 'message_id'>,
    ws: WebSocket,
  ): Promise<M> {

    const sentMessage = await new Promise((res, rej) => {
      const messageId = ++this.lastMessageId;
      const fullMessage = {
        ...message,
        message_id: messageId,
      } as M;
      this.log.debug('Sending WS message -> ', fullMessage);
      ws.send(
        JSON.stringify(fullMessage),
        (err) => {
          if (err) {
            this.log.warn('Failed to send message ->', fullMessage, err);
            rej(err);
          } else {
            this.log.debug('WS message sent ->', fullMessage);
            res(fullMessage);
          }
        },
      );
    });

    return await this._waitForResponse(sentMessage as M);
  }

  private _waitForResponse<M extends WsOutgoingMessage>(
    outgoingMessage: M,
  ): Promise<M> {
    return new Promise((res, rej) => {

      this.log.debug('Waiting for message response -> ', outgoingMessage);

      const timeout = setTimeout(() => {
        rej(new Error(`Didn't receive response in ${TIMEOUT}!`));
      }, TIMEOUT);

      const onMessage = (incomingMessage: WsIncomingMessage) => {
        if (
          incomingMessage.type === 'response' &&
          incomingMessage.message_id === outgoingMessage.message_id
        ) {
          this.log.debug('Received response for message -> ', outgoingMessage, incomingMessage);
          this.off('message', onMessage);
          clearTimeout(timeout);
          if (incomingMessage.status === 200) {
            res(outgoingMessage);
          } else {
            rej(incomingMessage);
          }
        }

      };

      this.on('message', onMessage);
    });
  }
}