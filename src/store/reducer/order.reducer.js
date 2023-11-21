//order CRUD
export const SET_ORDERS = 'SET_ORDERS'
export const ADD_ORDER = 'ADD_ORDER'
export const REMOVE_ORDER = 'REMOVE_ORDER'
export const UPDATE_ORDER = 'UPDATE_ORDER'
//Stage order
export const STAGE_ORDER = 'STAGE_ORDER'
export const CONFIRM_STAGED_ORDER = 'CONFIRM_STAGED_ORDER'
export const CLEAR_STAGED_ORDER = 'CLEAR_STAGED_ORDER'
//order status
export const UPDATE_ORDER_STATUS = 'UPDATE_ORDER_STATUS'
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
}
export const SET_ORDER_STATUS = 'SET_ORDER_STATUS'

const initialState = {
  orders: [],
  stagedOrder: null,
}

export function orderReducer(state = initialState, action = {}) {
  switch (action.type) {
    case SET_ORDERS:
      console.log('🚀 ~ file: order.reducer.js:15 ~ orderReducer ~ action.orders:', action.orders)

      return { ...state, orders: action.orders }

    case ADD_ORDER:
      return { ...state, orders: [...state.orders, action.order] }
    case REMOVE_ORDER:
      return { ...state, orders: state.orders.filter((order) => order._id !== action.orderId) }
    case UPDATE_ORDER:
      return {
        ...state,
        orders: state.orders.map((order) => (order._id === action.order._id ? action.order : order)),
      }
    case STAGE_ORDER:
      return { ...state, stagedOrder: action.order }

    case CLEAR_STAGED_ORDER:
      return { ...state, stagedOrder: null }

    case CONFIRM_STAGED_ORDER:
      return {
        ...state,
        orders: [...state.orders, state.stagedOrder],
        stagedOrder: null,
      }

    case UPDATE_ORDER_STATUS:
      return {
        ...state,
        orders: state.orders.map((order) => (order._id === action.orderId ? { ...order, status: action.status } : order)),
      }
    default:
      return state
  }
}
