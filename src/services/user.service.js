import { toast } from 'react-toastify'
import { storageService } from './async-storage.service'
import { httpService } from './http.service'
import axios from 'axios'
import { getBarbers, barberLogin, barberRegister, getBarber, updateBarber, deleteBarber } from '../utils/APIRouts.js'

const STORAGE_KEY_LOGGEDIN_USER = 'loggedinUser'

export const userService = {
  login,
  logout,
  signup,
  getLoggedinUser,
  saveLocalUser,
  getUsers,
  getById,
  remove,
  update,
  getEmptyCredentials,
  demoUser,
}

window.userService = userService
_createLocalUser()


function getUsers() {
  // return storageService.query('user')
  return axios.get(getBarbers)
}

async function getById(userId) {
  const user = await storageService.get('user', userId)
  // const user = await httpService.get(`user/${userId}`)
  return user
}

function remove(userId) {
  return storageService.remove('user', userId)
  // return httpService.delete(`user/${userId}`)
}

async function update(user) {
const urlReq = `${updateBarber}/${user._id}`
  const barber = await axios.put(urlReq, user)
  // update user using actions
  
  return barber
}

async function login(userCred) {
  const users = await storageService.query('user')
  const user = users.find(user => user.username === userCred.username)
  // const user = await httpService.post('auth/login', userCred)
  if (user) {
    return saveLocalUser(user)
  } else {
    return Promise.reject('Invalid username or password')
  }
}

async function signup(userCred) {
  const users = await axios.get(getBarbers)
  const userExist = users.data.find(user => user.username === userCred.username)
  if (userExist) {
    console.log('user name already exist');
    return
  } else {
    userCred.isBarber ? userCred.workDays = getDefultWorkDays() : console.log('not barber');
    userCred.isBarber ? userCred.reservations = [
      {
        date: "",
        time: "",
        customer: {
          fullname: "",
          phone: "",
          email: "",
        },
      }
    ]
      : console.log('not barber');
    
    const user = await axios.post(barberRegister, userCred)
    return saveLocalUser(user)
  }
}

async function logout() {
  sessionStorage.removeItem(STORAGE_KEY_LOGGEDIN_USER)
  // return await httpService.post('auth/logout')
}


function saveLocalUser(barber) {
  const returnBarber = {
    _id: barber._id,
    username: barber.username,
    fullname: barber.fullname,
    imgUrl: barber.imgUrl,
    workDays: barber.workDays,
    reservations: barber.reservations,
    isBarber: barber.isBarber,
  }
  sessionStorage.setItem(STORAGE_KEY_LOGGEDIN_USER, JSON.stringify(returnBarber))
  return returnBarber
}

function getLoggedinUser() {
  return JSON.parse(sessionStorage.getItem(STORAGE_KEY_LOGGEDIN_USER))
}

async function _createLocalUser() {
  const barbers = await userService.getUsers()

  if (!barbers.data.length) {
    console.log('creating local user');
    toast.info('Creating local user')
    await userService.signup({ fullname: 'Ramel Lausani', username: "ramel", password: 'ramel123', isBarber: true, imgUrl: 'https://iili.io/JxtxGON.md.jpg' })
  } else {
    console.log('barbershop user exist');
  }
}

function getEmptyCredentials() {
  return {
    username: '',
    password: '',
    fullname: '',
    imgUrl: ''
  }
}

function getDefultWorkDays() {
  const workDays = {
    monday: {
      isWorking: false,
      workHours: null,
    },
    tuesday: {
      isWorking: true,
      workHours: { start: '09:00', end: '20:00' },
    },
    wednesday: {
      isWorking: true,
      workHours: { start: '09:00', end: '20:00' },
    },
    thursday: {
      isWorking: true,
      workHours: { start: '09:00', end: '20:00' },
    },
    friday: {
      isWorking: true,
      workHours: { start: '09:00', end: '14:00' },
    },
    saturday: {
      isWorking: false,
      workHours: null,
    },
    sunday: {
      isWorking: true,
      workHours: { start: '09:00', end: '20:00' },
    },
  }
  return workDays
}

async function demoUser() {
  return {
    username: 'puki',
    password: '111',
  }
}
// ;(async () => {
//   await userService.signup({ fullname: 'Puki Norma', username: 'puki', password: '123', score: 10000, isAdmin: false })
//   await userService.signup({ fullname: 'Master Adminov', username: 'admin', password: '123', score: 10000, isAdmin: true })
//   await userService.signup({ fullname: 'Muki G', username: 'muki', password: '123', score: 10000 })
// })()