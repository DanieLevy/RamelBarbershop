import { httpService } from './http.service'
import { storageService } from './async-storage.service'
import { userService } from './user.service'

export const orderService = {
  add,
  query,
  remove,
}

async function query(filterBy) {
  try {
    const orders = await storageService.query('order')

    return orders
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

async function remove(orderId) {
  // await httpService.delete(`order/${orderId}`)
  await storageService.remove('order', orderId)
}

async function add(orderDetails) {
  const { startDate, endDate, adults, children, stay, buyer, hostId } = orderDetails

  const orderToAdd = {
    startDate,
    endDate,
    adults,
    children,
    stay: {
      _id: stay._id,
      name: stay.name,
      price: stay.price,
    },
    buyer: {
      _id: buyer._id,
      fullname: buyer.fullname,
    },
    hostId,
  }

  try {
    const addedOrder = await storageService.post('order', orderToAdd)
    return addedOrder
  } catch (err) {
    console.log('problem adding order!', err)
    throw err
  }
}
