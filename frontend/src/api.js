import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://proxy-free-attendance-system.onrender.com');

// Device ID management
let deviceId = localStorage.getItem('device_id');
if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
}

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'X-Device-ID': deviceId
    }
});

// Helper for dynamic websocket url
export const getWsUrl = (code) => {
    const wsProtocol = API_URL ? (API_URL.startsWith('https') ? 'wss://' : 'ws://') : (window.location.protocol === 'https:' ? 'wss://' : 'ws://');
    const wsHost = API_URL ? API_URL.replace(/^https?:\/\//, '') : window.location.host;
    return `${wsProtocol}${wsHost}/ws/session/${code}`;
};
