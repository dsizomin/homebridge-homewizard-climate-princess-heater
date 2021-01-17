import type WebSocket from 'ws';
import {WsOutgoingMessage} from './types';
import {HomebridgePrincessHeaterPlatform} from '../platform';
import {WS_URL} from './const';

export class WsClient {

  private lastMessageId = 0;

  public readonly outgoingMessages: {
    [key: number]: WsOutgoingMessage;
  } = {};

  constructor(
    public readonly ws: WebSocket,
    public readonly platform: HomebridgePrincessHeaterPlatform,
  ) {
  }

  public generateMessageId() {
    return ++this.lastMessageId;
  }

  public send(message: WsOutgoingMessage): Promise<void> {
    this.platform.log.debug('Sending WS message ->', message);
    this.outgoingMessages[message.message_id] = message;

    return new Promise((res, rej) => {
      this.ws.send(
        JSON.stringify(message),
        (err) => {
          if (err) {
            this.platform.log.warn('Failed to send message ->', message.message_id, err);
            rej(err);
          } else {
            res();
          }
        },
      );
    });
  }
}