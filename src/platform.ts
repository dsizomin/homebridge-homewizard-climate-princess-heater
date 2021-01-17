import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {HomewizardPrincessHeaterAccessory} from './platformAccessory';
import {
  HelloWsOutgoingMessage,
  PrincessHeaterAccessoryContext,
  ResponseWsIncomingMessage,
  WsIncomingMessage,
} from './ws/types';
import {DeviceType, MessageType} from './ws/const';
import {HttpAPIClient} from './http';
import {WsAPIClient} from './ws';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgePrincessHeaterPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory<PrincessHeaterAccessoryContext>[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
      this.log.debug('Finished initializing platform:', this.config.name);

      // When this event is fired it means Homebridge has restored all cached accessories from disk.
      // Dynamic Platform plugins should only register new accessories after this event was fired,
      // in order to ensure they weren't added to homebridge already. This event can also be used
      // to start discovery of new accessories.
      this.api.on('didFinishLaunching', () => {
        log.debug('Executed didFinishLaunching callback');
        // run the method to discover / register your devices as accessories
        this.discoverDevices().catch(err => {
          log.error('Failed to to device discovery', err);
        });
      });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory<PrincessHeaterAccessoryContext>) {
      this.log.info('Loading accessory from cache:', accessory.displayName);

      // add the restored accessory to the accessories cache so we can track if it has already been registered
      this.accessories.push(accessory);
    }

    async discoverDevices() {

      const authorizationHeaderValue = new Buffer(
        `${this.config.email}:${this.config.password}`,
      ).toString('base64');

      const httpAPIClient = new HttpAPIClient(this.log, authorizationHeaderValue);

      const token = await httpAPIClient.getToken();

      const wsAPIClient = new WsAPIClient(this.log, token);

      const devices = await httpAPIClient.getDevices();

      this.log.debug('Received a list of devices:', devices.map(d => d.name));

      const devicesUUIDs = devices.map(d => this.api.hap.uuid.generate(d.identifier));

      this.accessories
        .filter(a => !devicesUUIDs.includes(a.UUID))
        .forEach(a => {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [a]);
          this.log.info('Removing existing accessory from cache:', a.displayName);
        });

      devices.forEach((device, i) => {

        if (device.type === DeviceType.Heater) {

          const uuid = devicesUUIDs[i];

          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new HomewizardPrincessHeaterAccessory(this, existingAccessory, wsAPIClient);
            this.api.updatePlatformAccessories([existingAccessory]);
          } else {
            this.log.info('Adding new accessory:', device.name);

            const accessory = new this.api.platformAccessory(device.name, uuid);

            accessory.context.device = device;

            new HomewizardPrincessHeaterAccessory(
              this,
              accessory as PlatformAccessory<PrincessHeaterAccessoryContext>,
              wsAPIClient,
            );

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        } else {
          this.log.info('Unsupported device type:', device.type);
        }
      });
    }
}
