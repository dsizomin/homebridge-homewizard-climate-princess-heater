import {DeviceType, MessageType, PrincessHeaterMode} from './const';
import {DeviceResponseItem} from '../http';

export type WsOutgoingMessage = {
    type: MessageType;
    message_id: number;
};

export type HelloWsOutgoingMessage = WsOutgoingMessage & {
    type: MessageType.Hello;
    version: string;
    os: string;
    source: string;
    compatibility: number;
    token: string;
};

export type SubscribeWsOutgoingMessage = WsOutgoingMessage & {
    type: MessageType.SubscribeDevice;
    device: string;
};

export type JSONPatchWsOutgoingMessage = WsOutgoingMessage & {
    type: MessageType.JSONPatch;
    device: string;
    patch: [{
        op: string;
        path: string;
        value: boolean | number;
    }];
};

export type WsIncomingMessage = Record<string, unknown>;

export type ResponseWsIncomingMessage = WsIncomingMessage & {
    type: 'response';
    message_id: number;
    status: number;
};

export type DeviceMetaData = {
    type: DeviceType;
    device: string;
    online: boolean;
    version: string;
    model: string;
    name: string;
};

export type StateWsIncomingMessage<S> = WsIncomingMessage & DeviceMetaData & {
    state: S;
};

export type PrincessHeaterMetadata = DeviceMetaData & {
    type: DeviceType.Heater;
};

export type PrincessHeaterState = {
    power_on: boolean;
    lock: boolean;
    target_temperature: number;
    current_temperature: number;
    timer: number;
    mode: PrincessHeaterMode;
};

export type PrincessHeaterStateWsIncomingMessage = StateWsIncomingMessage<PrincessHeaterState>;

export type JSONPatchWsIncomingMessage = WsIncomingMessage & {
    type: MessageType.JSONPatch;
    device: string;
    patch: [{
        op: string;
        path: string;
        value: boolean | number;
    }];
};


export type PrincessHeaterAccessoryContext = {
    device: DeviceResponseItem & {
        type: DeviceType.Heater;
    };
    metadata: PrincessHeaterMetadata;
};