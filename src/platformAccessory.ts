import {CharacteristicSetCallback, CharacteristicValue, PlatformAccessory, Service, Units} from 'homebridge';

import {HomebridgePrincessHeaterPlatform} from './platform';
import {
    JSONPatchWsIncomingMessage,
    JSONPatchWsOutgoingMessage,
    PrincessHeaterAccessoryContext,
    PrincessHeaterState,
    PrincessHeaterStateWsIncomingMessage,
    SubscribeWsOutgoingMessage
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
    // private state: PrincessHeaterState | null = null;

    constructor(
        private readonly platform: HomebridgePrincessHeaterPlatform,
        private readonly accessory: PlatformAccessory<PrincessHeaterAccessoryContext>,
        private readonly wsClient: WsClient,
    ) {

        this.service = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .setProps({
                validValues: [
                    this.platform.Characteristic.TargetHeatingCoolingState.OFF,
                    this.platform.Characteristic.TargetHeatingCoolingState.HEAT
                ]
            })
            .on('set', this.setTargetHeatingCoolingState.bind(this));


        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
            .setProps({
                unit: Units.CELSIUS,
                minStep: 1
            })
            .on('set', this.setTargetTemperature.bind(this))


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
        } else if ('type' in incomingMessage && incomingMessage.type === MessageType.JSONPatch) {
            this.onJSONMessage(incomingMessage)
        }
    }

    onJSONMessage(message: JSONPatchWsIncomingMessage) {
        message.patch.forEach(patchItem => {
            const {op, path, value} = patchItem

            if (op === 'replace') {
                const match = path.match(/^\/state\/(.*)$/)
                if (match && match[1]) {
                    const stateKey = match[1];

                    switch (stateKey) {
                        case 'power_on':
                            this.service.updateCharacteristic(
                                this.platform.Characteristic.CurrentHeatingCoolingState,
                                value ?
                                    this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
                                    this.platform.Characteristic.CurrentHeatingCoolingState.OFF
                            );
                            break;
                        case 'current_temperature':
                            this.service.updateCharacteristic(
                                this.platform.Characteristic.CurrentTemperature,
                                value
                            );
                            break;
                    }
                }
            }
        })
    }

    onStateMessage(message: PrincessHeaterStateWsIncomingMessage) {
        this.platform.log.info('Updating state from message ->', message);
        // this.state = message.state

        Object.keys(message.state).forEach(key => {
            const value = message.state[key]

            switch (key) {
                case 'power_on':
                    this.service.setCharacteristic(
                        this.platform.Characteristic.CurrentHeatingCoolingState,
                        value ?
                            this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
                            this.platform.Characteristic.CurrentHeatingCoolingState.OFF
                    );
                    break;
                case 'current_temperature':
                    this.service.setCharacteristic(
                        this.platform.Characteristic.CurrentTemperature,
                        value
                    );
                    break;
            }
        })
    }

    setTargetHeatingCoolingState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        // if (this.state) {

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
                callback(new Error('Unsupported characteristic value'))
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

        this.wsClient.send(message);

        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, normalizedValue)

        callback(null)
        // } else {
        //     this.platform.log.warn('Trying to set TargetHeatingCoolingState but state is null');
        //     callback(new Error('Trying to set TargetHeatingCoolingState but state is null'))
        // }
    }

    setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        // if (this.state) {

        const message: JSONPatchWsOutgoingMessage = {
            type: MessageType.JSONPatch,
            message_id: this.wsClient.generateMessageId(),
            device: this.accessory.context.device.identifier,
            patch: [{
                op: "replace",
                path: `/state/target_temperature`,
                value: value
            }]
        }

        this.platform.log.debug('Set Characteristic TargetTemperature ->', value);

        this.wsClient.send(message);

        this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, value)

        callback(null)
        // } else {
        //     this.platform.log.warn('Trying to set TargetTemperature but state is null');
        //     callback(new Error('Trying to set TargetTemperature but state is null'))
        // }
    }
}
