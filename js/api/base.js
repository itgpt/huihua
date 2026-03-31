import { fetchWithTimeout } from '../utils/http.js';

export class APIClient {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async post(endpoint, body, timeout) {
        return fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        }, timeout);
    }
    
    async postFormData(endpoint, formData, timeout) {
        return fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${this.apiKey}`, 
                'Accept': 'application/json' 
            },
            body: formData
        }, timeout);
    }

    async get(endpoint, timeout) {
        return fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders()
        }, timeout);
    }
}
