export const host = "https://danielevy-backend.onrender.com";
// rewrite all barber routes to use barber.* instead of barber.*
const getBarbers = `${host}/api/barbershop/users`;
const barberLogin = `${host}/api/barbershop/login`;
const barberRegister = `${host}/api/barbershop/register`;
const getBarber = `${host}/api/barbershop/user`;
const updateBarber = `${host}/api/barbershop/user`;
const deleteBarber = `${host}/api/barbershop/user`;

// export using barber.* for all barber routes
export const barberAPI = {
  getBarbers,
  barberLogin,
  barberRegister,
  getBarber,
  updateBarber,
  deleteBarber,
};



