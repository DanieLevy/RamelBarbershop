import Axios from 'axios'
import { barberAPI } from '../utils/APIRouts.js'

var axios = Axios.create({
    withCredentials: true
})

export const httpService = {
    get(endpoint, data) {
        console.log('data: ', data);
        console.log('endpoint: ', endpoint);
        return ajax(barberAPI[endpoint], 'GET', data);
    },
    post(endpoint, data) {
        return ajax(barberAPI[endpoint], 'POST', data);
    },
    put(endpoint, data) {
        return ajax(barberAPI[endpoint], 'PUT', data);
    },
    delete(endpoint, data) {
        return ajax(barberAPI[endpoint], 'DELETE', data);
    }
};

async function ajax(endpoint, method = 'GET', data = null) {
    try {
        const res = await axios({
            url: `${endpoint}`,
            method,
            data,
            params: (method === 'GET') ? data : null
        })
        console.log('res: ', res);
        console.log('res.data: ', res.data);
        return res.data
    } catch (err) {
        console.log(`Had Issues ${method}ing to the backend, endpoint: ${endpoint}, with data: `, data)
        console.dir(err)
        if (err.response && err.response.status === 401) {
            sessionStorage.clear()
            window.location.assign('/')
        }
        throw err
    }
}