import { legacy_createStore as createStore, combineReducers } from 'redux'

import { stayReducer } from './reducer/stay.reducer.js'
import { userReducer } from './reducer/user.reducer.js'
import { orderReducer } from './reducer/order.reducer.js'
import { systemReducer } from './reducer/system.reducer.js'

const rootReducer = combineReducers({
  stayModule: stayReducer,
  userModule: userReducer,
  systemModule: systemReducer,
  orderModule: orderReducer,
})

const middleware = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__() : undefined
export const store = createStore(rootReducer, middleware)

// store.subscribe(() => {
//   console.log('**** Store state changed: ****')
//   console.log('storeState:\n', store.getState())
//   console.log('*******************************')
// })
