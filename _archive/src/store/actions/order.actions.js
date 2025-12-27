import { orderService } from '../../services/order.service'
import { store } from '../store.js'
import {
  ADD_ORDER,
  CLEAR_STAGED_ORDER,
  CONFIRM_STAGED_ORDER,
  REMOVE_ORDER,
  SET_ORDERS,
  STAGE_ORDER,
  UPDATE_ORDER_STATUS,
} from '../reducer/order.reducer'
import { LOADING_DONE, LOADING_START } from '../reducer/system.reducer'

// Synchronous Action Creators
export function getActionRemoveOrder(orderId) {
  return { type: REMOVE_ORDER, orderId }
}

export function getActionAddOrder(order) {
  return { type: ADD_ORDER, order }
}

export function setOrdersAction(orders) {
  return { type: SET_ORDERS, orders }
}
export function getActionUpdateOrderStatus(orderId, status) {
  return { type: UPDATE_ORDER_STATUS, orderId, status }
}

export function getActionStageOrder(order) {
  return { type: STAGE_ORDER, order }
}

export function getActionClearStagedOrder() {
  return { type: CLEAR_STAGED_ORDER }
}

export function getActionConfirmOrder() {
  return { type: CONFIRM_STAGED_ORDER }
}

// Asynchronous Functions
export async function loadOrders() {
  store.dispatch({ type: LOADING_START })
  try {
    const orders = await orderService.query()

    store.dispatch({ type: SET_ORDERS, orders })
  } catch (err) {
    console.log('OrderActions: err in loadOrders', err)
    throw err
  } finally {
    store.dispatch({ type: LOADING_DONE })
  }
}

export async function addOrder(order) {
  store.dispatch({ type: LOADING_START })
  try {
    const addedOrder = await orderService.add(order)
    store.dispatch(getActionAddOrder(addedOrder))
  } catch (err) {
    console.log('OrderActions: err in addOrder', err)
    throw err
  } finally {
    store.dispatch({ type: LOADING_DONE })
  }
}

export async function removeOrder(orderId) {
  try {
    await orderService.remove(orderId)
    store.dispatch(getActionRemoveOrder(orderId))
  } catch (err) {
    console.log('OrderActions: err in removeOrder', err)
    throw err
  }
}
export async function updateOrderStatus(orderId, status) {
  store.dispatch({ type: LOADING_START })
  try {
    await orderService.updateStatus(orderId, status)
    store.dispatch(getActionUpdateOrderStatus(orderId, status))
  } catch (err) {
    console.log('OrderActions: err in updateOrderStatus', err)
    throw err
  } finally {
    store.dispatch({ type: LOADING_DONE })
  }
}
