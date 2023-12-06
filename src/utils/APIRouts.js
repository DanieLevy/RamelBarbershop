export const host = "https://danielevy-backend.onrender.com";
// export const host = "http://localhost:5000";
// rewrite all barber routes to use barber.* instead of barber.*
export const getBarbers = `${host}/api/barbershop/users`;
export const barberLogin = `${host}/api/barbershop/login`;
export const barberRegister = `${host}/api/barbershop/register`;
export const getBarber = `${host}/api/barbershop/user`;
export const updateBarber = `${host}/api/barbershop/user`;
export const deleteBarber = `${host}/api/barbershop/user`;

