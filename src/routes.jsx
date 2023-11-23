import { BarberIndex } from './pages/BarberIndex.jsx'
import { BarberLogin } from './pages/BarberLogin.jsx'
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
  },
  {
    path: '/login',
    component: <BarberLogin />,
  }
]

export default routes
