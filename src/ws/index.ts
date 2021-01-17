import WebSocket from 'ws';
import {WsOutgoingMessage} from './types';
import {MessageType, WS_URL} from './const';
import {EventEmitter} from 'events';
import {Logger} from 'homebridge';

const OPEN_TIMEOUT = 60 * 1000; // 1 minute

export class WsClient extends EventEmitter {

  private lastMessageId = 0;

  private ws: WebSocket | null = null;

  constructor(
    private readonly log: Logger,
  ) {
    super();
  }

  private open(): Promise<WebSocket> {
    return new Promise((res, rej) => {
      this.log.debug('Opening WS connection to ->', WS_URL);
      const ws = new WebSocket(WS_URL);

      ws.on('message', (message: string) => {
        const json = JSON.parse(message);
        this.log.debug('Incoming message:', json);
        super.emit(json);
      });

      ws.on('error', (error) => {
        this.log.error('Unexpected error in WS connection ->', error);
      });

      ws.on('close', () => {
        this.log.debug('Closing WS connection to ->', WS_URL);
      });

      const openTimeout = setTimeout(() => {
        rej(new Error(`WS connection was not ready in ${OPEN_TIMEOUT}ms`));
      }, OPEN_TIMEOUT);

      ws.on('open', () => {
        clearTimeout(openTimeout);
        this.log.debug('Opened WS connection to ->', WS_URL);
        res(ws);
      });
    });
  }

  public async send<M extends WsOutgoingMessage>(
    message: Omit<M, 'message_id'>,
  ): Promise<M> {

    const wsPromise: Promise<WebSocket> = new Promise((res, rej) => {
      if (
        !this.ws ||
        this.ws.readyState === WebSocket.CLOSING ||
        this.ws.readyState === WebSocket.CLOSED
      ) {

        this.log.warn('WS connection is not initialized or closed. Attempting to reopen');

        this.open()
          .then((ws) => {
            this.ws = ws;
            res(ws);
          })
          .catch(err => rej(err));
      } else {
        return res(this.ws);
      }
    });

    const ws = await wsPromise;

    return new Promise((res, rej) => {
      const messageId = ++this.lastMessageId;
      const fullMessage = {
        ...message,
        message_id: messageId,
      } as M;
      ws.send(
        JSON.stringify(fullMessage),
        (err) => {
          if (err) {
            this.log.warn('Failed to send message ->', fullMessage, err);
            rej(err);
          } else {
            res(fullMessage);
          }
        },
      );
    });
  }
}