import {
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    PlatformAccessory,
    Service
} from 'homebridge';

import {HomebridgePrincessHeaterPlatform} from './platform';
import {
    JSONPatchWsOutgoingMessage,
    PrincessHeaterAccessoryContext,
    PrincessHeaterState,
    PrincessHeaterStateWsIncomingMessage,
    ResponseWsIncomingMessage,
    SubscribeWsOutgoingMessage,
    WsIncomingMessage
} from "./ws/types";
import {WsClient} from "./ws/client";
import {MessageType} from "./ws/const";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomewizardPrincessHeaterAccessory {
    private service: Service;

    /**
     * These are just used to create a working example
     * You should implement your own code to track the state of your accessory
     */
    private state: PrincessHeaterState | null = null;

    private settersCallbackMap: {
        [messageId: number]: CharacteristicSetCallback
    } = {}

    constructor(
        private readonly platform: HomebridgePrincessHeaterPlatform,
        private readonly accessory: PlatformAccessory<PrincessHeaterAccessoryContext>,
        private readonly wsClient: WsClient,
    ) {

        this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

        this.service.getCharacteristic(this.platform.Characteristic.On)
            .on('set', this.setOn.bind(this))
            .on('get', this.getOn.bind(this));

        this.wsClient.ws.on('message', this.onWsMessage.bind(this));

        this.platform.log.info('Subscribing to device updates:', this.accessory.context.device.name);

        const message: SubscribeWsOutgoingMessage = {
            type: MessageType.SubscribeDevice,
            device: this.accessory.context.device.identifier,
            message_id: wsClient.generateMessageId()
        }

        wsClient.send(message)
    }

    onWsMessage(message: string) {
        const incomingMessage = JSON.parse(message)
        if ('state' in incomingMessage) {
            this.onStateMessage(incomingMessage)
        } else if ('message_id' in incomingMessage) {
            const requestMessage = this.wsClient.outgoingMessages[incomingMessage.message_id];
            if (
                requestMessage.type === MessageType.JSONPatch &&
                requestMessage.device === this.accessory.context.device.identifier
            ) {
                this.onJSONPatchResponse(incomingMessage)
            }
        }
    }

    onJSONPatchResponse(message: ResponseWsIncomingMessage) {
        const messageId = message.message_id;
        if (
            messageId in this.settersCallbackMap
        ) {
            const callback = this.settersCallbackMap[messageId]
            callback.call(null, message.status === 200 ? null : new Error(JSON.stringify(message)))
        }
    }

    onStateMessage(message: PrincessHeaterStateWsIncomingMessage) {
        this.state = message.state
    }

    setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (this.state) {
            this.platform.log.debug('Set Characteristic On ->', value);
            this.state.power_on = true;

            const message: JSONPatchWsOutgoingMessage = {
                type: MessageType.JSONPatch,
                message_id: this.wsClient.generateMessageId(),
                device: this.accessory.context.device.identifier,
                patch: [{
                    op: "replace",
                    path: "/state/power_on",
                    value: value
                }]
            }

            this.settersCallbackMap[message.message_id] = callback;

            this.wsClient.send(message);
        } else {
            this.platform.log.warn('Setting Characteristic On, but device state is null ->', value);
        }
    }

    getOn(callback: CharacteristicGetCallback) {
        const isOn = this.state ? this.state.power_on : false;
        this.platform.log.debug('Get Characteristic On ->', isOn);
        callback(null, isOn);
    }

}
