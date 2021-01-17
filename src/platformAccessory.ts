import {
    Characteristic,
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
import {normalizeSlashes} from "ts-node";

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

    private readonly settersCallbackMap: {
        [messageId: number]: (Error?) => void
    } = {}

    constructor(
        private readonly platform: HomebridgePrincessHeaterPlatform,
        private readonly accessory: PlatformAccessory<PrincessHeaterAccessoryContext>,
        private readonly wsClient: WsClient,
    ) {

        this.service = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .on('set', this.setTargetHeatingCoolingState.bind(this))
            .on('get', this.getTargetHeatingCoolingState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
            .on('set', this.setTargetTemperature.bind(this))
            .on('get', this.getTargetTemperature.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));

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
            delete this.settersCallbackMap[messageId]
        }
    }

    onStateMessage(message: PrincessHeaterStateWsIncomingMessage) {
        this.platform.log.info('Updating state from message ->', message);
        this.state = message.state
    }

    getCurrentHeaterCoolerState(callback: CharacteristicGetCallback) {
        if (this.state) {
            const value = this.state.power_on ?
                this.platform.Characteristic.CurrentHeaterCoolerState.HEATING :
                this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE

            this.platform.log.debug('Get Characteristic CurrentHeaterCoolerState ->', value, this.state.power_on);
            callback(null, value)
        } else {
            this.platform.log.warn('Trying to get CurrentHeaterCoolerState but state is null');
            callback(null, this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE)
        }
    }

    getCurrentHeatingCoolingState(callback: CharacteristicGetCallback) {
        if (this.state) {
            const value = this.state.power_on ?
                this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
                this.platform.Characteristic.CurrentHeatingCoolingState.OFF

            this.platform.log.debug('Get Characteristic CurrentHeatingCoolingState ->', value, this.state.power_on);
            callback(null, value)
        } else {
            this.platform.log.warn('Trying to get CurrentHeatingCoolingState but state is null');
            callback(null, this.platform.Characteristic.CurrentHeatingCoolingState.OFF)
        }
    }

    getTargetHeatingCoolingState(callback: CharacteristicGetCallback) {
        if (this.state) {
            const value = this.state.power_on ?
                this.platform.Characteristic.TargetHeatingCoolingState.HEAT :
                this.platform.Characteristic.TargetHeatingCoolingState.OFF

            this.platform.log.debug('Get Characteristic TargetHeatingCoolingState ->', value, this.state.power_on);
            callback(null, value)
        } else {
            this.platform.log.warn('Trying to get TargetHeatingCoolingState but state is null');
            callback(null, this.platform.Characteristic.TargetHeatingCoolingState.OFF)
        }
    }

    setTargetHeatingCoolingState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (this.state) {

            let currentValue: CharacteristicValue = this.state.power_on ?
                this.platform.Characteristic.TargetHeatingCoolingState.HEAT :
                this.platform.Characteristic.TargetHeatingCoolingState.OFF;

            let stateValue: boolean
            let normalizedValue: CharacteristicValue = value

            switch (value) {
                case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
                case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
                    stateValue = false;
                    normalizedValue = this.platform.Characteristic.TargetHeatingCoolingState.OFF
                    break;
                case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
                case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
                    stateValue = true;
                    normalizedValue = this.platform.Characteristic.TargetHeatingCoolingState.HEAT
                    break;
                default:
                    this.platform.log.warn('Setting Characteristic TargetHeatingCoolingState, but value is not supported ->', value);
                    callback(new Error('Unsupported characteristic value'), currentValue)
                    return;
            }

            this.platform.log.debug('Set Characteristic TargetHeatingCoolingState ->', value, stateValue);

            const message: JSONPatchWsOutgoingMessage = {
                type: MessageType.JSONPatch,
                message_id: this.wsClient.generateMessageId(),
                device: this.accessory.context.device.identifier,
                patch: [{
                    op: "replace",
                    path: `/state/power_on`,
                    value: stateValue
                }]
            }

            this.settersCallbackMap[message.message_id] = (err) => err ?
                callback(err, currentValue) :
                callback(
                    normalizedValue === value ? null : new Error('Value has been normalized'),
                    normalizedValue
                )

            this.wsClient.send(message);
        } else {
            this.platform.log.warn('Trying to set TargetHeatingCoolingState but state is null');
            callback(null, this.platform.Characteristic.TargetHeatingCoolingState.OFF)
        }
    }

    getCurrentTemperature(callback: CharacteristicGetCallback) {
        if (this.state) {
            this.platform.log.debug('Get Characteristic CurrentTemperature ->', this.state.current_temperature, this.state.current_temperature);
            callback(null, this.state.current_temperature)
        } else {
            this.platform.log.warn('Trying to get CurrentTemperature but state is null');
            callback(null, 0)
        }
    }

    getTargetTemperature(callback: CharacteristicGetCallback) {
        if (this.state) {
            this.platform.log.debug('Get Characteristic TargetTemperature ->', this.state.target_temperature, this.state.target_temperature);
            callback(null, this.state.target_temperature)
        } else {
            this.platform.log.warn('Trying to get TargetTemperature but state is null');
            callback(null, 0)
        }
    }

    setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (this.state) {

            const currentValue: number = this.state.current_temperature

            let normalizedValue: number = Math.round(Number(value))

            const message: JSONPatchWsOutgoingMessage = {
                type: MessageType.JSONPatch,
                message_id: this.wsClient.generateMessageId(),
                device: this.accessory.context.device.identifier,
                patch: [{
                    op: "replace",
                    path: `/state/target_temperature`,
                    value: normalizedValue
                }]
            }

            this.platform.log.debug('Set Characteristic TargetTemperature ->', value, normalizedValue);

            this.settersCallbackMap[message.message_id] = (err) => err ?
                callback(err, currentValue) :
                callback(
                    normalizedValue === value ? null : new Error('Value has been normalized'),
                    normalizedValue
                )

            this.wsClient.send(message);
        } else {
            this.platform.log.warn('Trying to set TargetTemperature but state is null');
            callback(null, 0)
        }
    }
}
