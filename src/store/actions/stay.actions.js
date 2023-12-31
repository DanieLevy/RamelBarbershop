import { stayService } from '../../services/stay.service.local.js'
import { userService } from '../../services/user.service.js'
import { store } from '../store.js'
import { showSuccessMsg, showErrorMsg } from '../../services/event-bus.service.js'
import { ADD_STAY, REMOVE_STAY, SET_STAYS, UNDO_REMOVE_STAY, UPDATE_STAY } from '../reducer/stay.reducer.js'

export function getActionRemoveStay(stayId) {
  return {
    type: REMOVE_STAY,
    stayId,
  }
}
export function getActionAddStay(stay) {
  return {
    type: ADD_STAY,
    stay,
  }
}
export function getActionUpdateStay(stay) {
  return {
    type: UPDATE_STAY,
    stay,
  }
}

export async function loadBarbers(filterBy) {
  console.log('loading barbers')
  try {
    const stays = await stayService.query(filterBy)
    console.log('barbers from DB:', stays)
    store.dispatch({
      type: SET_STAYS,
      stays,
    })
  } catch (err) {
    console.log('Cannot load stays', err)
    throw err
  }
}

export async function loadStay(stayId) {
  console.log('loading stays')
  try {
    const stay = await stayService.getById(stayId)
    console.log('Stays from DB:', stayId)
    return stay
  } catch (err) {
    console.log('Cannot load stays', err)
    throw err
  }
}

export async function removeStay(stayId) {
  try {
    await stayService.remove(stayId)
    store.dispatch(getActionRemoveStay(stayId))
  } catch (err) {
    console.log('Cannot remove stay', err)
    throw err
  }
}

export async function addStay(stay) {
  try {
    const savedStay = await stayService.save(stay)
    console.log('Added Stay', savedStay)
    store.dispatch(getActionAddStay(savedStay))
    return savedStay
  } catch (err) {
    console.log('Cannot add stay', err)
    throw err
  }
}

export async function updateStay(stay) {
  try {
    const savedStay = await stayService.save(stay)
    console.log('Updated Stay:', savedStay)
    store.dispatch(getActionUpdateStay(savedStay))
    return savedStay
  } catch (err) {
    console.log('Cannot save stay', err)
    throw err
  }
}

export function onRemoveStayOptimistic(stayId) {
  store.dispatch({
    type: REMOVE_STAY,
    stayId,
  })
  showSuccessMsg('Stay removed')

  stayService
    .remove(stayId)
    .then(() => {
      console.log('Server Reported - Deleted Succesfully')
    })
    .catch((err) => {
      showErrorMsg('Cannot remove stay')
      console.log('Cannot load stays', err)
      store.dispatch({
        type: UNDO_REMOVE_STAY,
      })
    })
}