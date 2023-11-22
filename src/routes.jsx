import { BarberIndex } from './pages/BarberIndex.jsx'
import { BarberProfile } from './pages/BarberProfile.jsx'

const routes = [
  {
    path: '/',
    component: <BarberIndex />,
    label: 'Home',
  },
  {
    path: '/barber/:barberId',
    component: <BarberProfile />,
  }
]

export default routes
