import axios, {AxiosInstance} from 'axios';
import {AUTH_URL, DEVICES_URL} from './const';
import {DeviceType} from '../ws/const';

export type DeviceResponseItem = {
  // endpoint: never;
  // grants: never;
  identifier: string;
  name: string;
  type: DeviceType;
};

export class HttpAPIClient {

  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly authorization: string) {
    this.axiosInstance = axios.create({
      headers: {
        Authorization: this.authorization,
      },
    });
  }

  login(): Promise<{ token: string }> {
    return this.axiosInstance.get(AUTH_URL).then(response => response.data);
  }

  getDevices(): Promise<DeviceResponseItem[]> {
    return this.axiosInstance.get(DEVICES_URL).then(response => response.data.devices);
  }
}
