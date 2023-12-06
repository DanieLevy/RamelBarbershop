import { userService } from '../../services/user.service.js'
import { socketService } from '../../services/socket.service.js'
import { store } from '../store.js'

import { showErrorMsg } from '../../services/event-bus.service.js'
import { LOADING_DONE, LOADING_START } from '../reducer/system.reducer.js'
import { REMOVE_USER, SET_USER, SET_USERS, SET_WATCHED_USER } from '../reducer/user.reducer.js'

export async function loadUsers() {
  try {
    store.dispatch({ type: LOADING_START })
    const users = await userService.getUsers()
    console.log('users from actions', users.data);
    const barbers = users.data.filter(user => user.isBarber)
    store.dispatch({ type: SET_USERS, users: barbers })
  } catch (err) {
    console.log('UserActions: err in loadUsers', err)
  } finally {
    store.dispatch({ type: LOADING_DONE })
  }
}

export async function removeUser(userId) {
  try {
    await userService.remove(userId)
    store.dispatch({ type: REMOVE_USER, userId })
  } catch (err) {
    console.log('UserActions: err in removeUser', err)
  }
}

export async function login(credentials) {
  console.log('login from actions');
  try {
    const user = await userService.login(credentials)
    store.dispatch({
      type: SET_USER,
      user,
    })
    return user
  } catch (err) {
    console.log('Cannot login', err)
    throw err
  }
}

export async function signup(credentials) {
  try {
    credentials.isAdmin = false
    credentials.isBarber === true ? console.log('is barber') : console.log('is not barber');
    const user = await userService.signup(credentials)
    store.dispatch({
      type: SET_USER,
      user,
    })
    // socketService.login(user)
    return user
  } catch (err) {
    console.log('Cannot signup', err)
    throw err
  }
}

export async function logout() {
  try {
    await userService.logout()
    store.dispatch({
      type: SET_USER,
      user: null,
    })
    // socketService.logout()
  } catch (err) {
    console.log('Cannot logout', err)
    throw err
  }
}

export async function loadUser(userId) {
  try {
    const user = await userService.getById(userId)
    store.dispatch({ type: SET_WATCHED_USER, user })
  } catch (err) {
    showErrorMsg('Cannot load user')
    console.log('Cannot load user', err)
  }
}

export async function updateUser(user) {
  try {
    console.log('user from actions', user);
    const updatedUser = await userService.update(user)
    console.log('updatedUser from actions', updatedUser);
    store.dispatch({ type: SET_USER, user: updatedUser })
    return updatedUser
  } catch (err) {
    showErrorMsg('Cannot update user')
    console.log('Cannot update user', err)
  }
}