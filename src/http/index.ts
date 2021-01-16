import axios from 'axios'
import {AUTH_URL, DEVICES_URL} from "./const";
import {DeviceType} from "../ws/const";

export type DeviceResponseItem = {
    endpoint: any
    grants: any
    identifier: string
    name: string
    type: DeviceType
};

export const login = (authorization: string): Promise<{ token: string }> => axios.get(AUTH_URL, {
    headers: {
        Authorization: authorization
    }
}).then(response => response.data)

export const getDevices = (authorization: string): Promise<DeviceResponseItem[]> => axios.get(DEVICES_URL, {
    headers: {
        Authorization: authorization
    }
}).then(response => response.data.devices)
