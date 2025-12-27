import { toast } from 'react-toastify'
import { storageService } from './async-storage.service'
import { supabase } from '../supabase/supabaseClient'

const STORAGE_KEY_LOGGEDIN_USER = 'loggedinUser'

export const userService = {
  login,
  logout,
  signup,
  getLoggedinUser,
  saveLocalUser,
  getUsers,
  getById,
  remove,
  update,
  getEmptyCredentials,
  demoUser,
}

window.userService = userService
_createLocalUser()

async function getUsers() {
  try {
    // Get only barbers (is_barber = true) with their work days
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        *,
        work_days(*)
      `)
      .eq('is_barber', true);

    if (error) throw error;
    
    // Format work days to match the expected structure in the app
    const formattedUsers = users.map(user => {
      const workDays = {};
      
      // Initialize default structure
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      daysOfWeek.forEach(day => {
        workDays[day] = {
          isWorking: false,
          workHours: null
        };
      });
      
      // Fill in actual work days
      user.work_days.forEach(day => {
        workDays[day.day_of_week] = {
          isWorking: day.is_working,
          workHours: day.is_working ? { start: day.start_time, end: day.end_time } : null
        };
      });
      
      // Get reservations for this barber
      return {
        _id: user.id,
        username: user.username,
        fullname: user.fullname,
        imgUrl: user.img_url,
        isBarber: user.is_barber,
        workDays,
        reservations: [] // We'll fetch reservations separately
      };
    });

    // Get reservations for all barbers
    for (const user of formattedUsers) {
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id,
          service_id,
          customer_name,
          customer_phone,
          date_timestamp,
          time_timestamp,
          day_name,
          day_num,
          status,
          services(*)
        `)
        .eq('barber_id', user._id);
      
      if (resError) throw resError;
      
      // Format reservations to match app structure
      user.reservations = reservations.map(res => ({
        _id: res.id,
        customer: {
          fullname: res.customer_name,
          phone: res.customer_phone
        },
        barberId: user._id,
        service: {
          _id: res.service_id,
          name: res.services.name,
          price: res.services.price,
          description: res.services.description,
          duration: res.services.duration
        },
        date: {
          dayName: res.day_name,
          dayNum: res.day_num,
          dateTimestamp: res.date_timestamp,
          timeTimestamp: res.time_timestamp
        },
        status: res.status
      }));
    }

    return { data: formattedUsers };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

async function getById(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        work_days(*)
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;
    
    // Format work days to match the expected structure in the app
    const workDays = {};
    
    // Initialize default structure
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    daysOfWeek.forEach(day => {
      workDays[day] = {
        isWorking: false,
        workHours: null
      };
    });
    
    // Fill in actual work days
    user.work_days.forEach(day => {
      workDays[day.day_of_week] = {
        isWorking: day.is_working,
        workHours: day.is_working ? { start: day.start_time, end: day.end_time } : null
      };
    });

    // Get reservations for this barber
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select(`
        id,
        service_id,
        customer_name,
        customer_phone,
        date_timestamp,
        time_timestamp,
        day_name,
        day_num,
        status,
        services(*)
      `)
      .eq('barber_id', userId);
      
    if (resError) throw resError;
    
    // Format reservations to match app structure
    const formattedReservations = reservations.map(res => ({
      _id: res.id,
      customer: {
        fullname: res.customer_name,
        phone: res.customer_phone
      },
      barberId: userId,
      service: {
        _id: res.service_id,
        name: res.services.name,
        price: res.services.price,
        description: res.services.description,
        duration: res.services.duration
      },
      date: {
        dayName: res.day_name,
        dayNum: res.day_num,
        dateTimestamp: res.date_timestamp,
        timeTimestamp: res.time_timestamp
      },
      status: res.status
    }));

    return {
      _id: user.id,
      username: user.username,
      fullname: user.fullname,
      imgUrl: user.img_url,
      isBarber: user.is_barber,
      workDays,
      reservations: formattedReservations
    };
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
}

async function remove(userId) {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing user:', error);
    throw error;
  }
}

async function update(user) {
  try {
    // First update the user basic info
    const { error: userError } = await supabase
      .from('users')
      .update({
        fullname: user.fullname,
        img_url: user.imgUrl,
        updated_at: new Date()
      })
      .eq('id', user._id);
    
    if (userError) throw userError;

    // Handle work days update if this is a barber
    if (user.isBarber && user.workDays) {
      // Delete existing work days
      const { error: deleteError } = await supabase
        .from('work_days')
        .delete()
        .eq('user_id', user._id);
      
      if (deleteError) throw deleteError;

      // Insert new work days
      const workDaysToInsert = [];
      Object.entries(user.workDays).forEach(([day, value]) => {
        workDaysToInsert.push({
          user_id: user._id,
          day_of_week: day,
          is_working: value.isWorking,
          start_time: value.workHours?.start || null,
          end_time: value.workHours?.end || null
        });
      });

      const { error: insertError } = await supabase
        .from('work_days')
        .insert(workDaysToInsert);
        
      if (insertError) throw insertError;
    }

    // Handle reservations if provided
    if (user.reservations && user.reservations.length > 0) {
      // Check for new reservations (the last one is usually the newest)
      const newReservation = user.reservations[user.reservations.length - 1];
      
      // Check if this reservation already exists in the database
      const { data: existingRes } = await supabase
        .from('reservations')
        .select('id')
        .eq('id', newReservation._id);
      
      // If it doesn't exist, insert it
      if (!existingRes || existingRes.length === 0) {
        // Get the service ID first
        const { data: serviceData } = await supabase
          .from('services')
          .select('id')
          .eq('name', newReservation.service.name)
          .single();
          
        const serviceId = serviceData?.id;
        
        if (!serviceId) {
          throw new Error('Service not found');
        }
        
        const { error: resError } = await supabase
          .from('reservations')
          .insert({
            id: newReservation._id,
            barber_id: user._id,
            service_id: serviceId,
            customer_name: newReservation.customer.fullname,
            customer_phone: newReservation.customer.phone,
            date_timestamp: newReservation.date.dateTimestamp,
            time_timestamp: newReservation.date.timeTimestamp,
            day_name: newReservation.date.dayName,
            day_num: newReservation.date.dayNum,
            status: 'confirmed'
          });
          
        if (resError) throw resError;
      }
    }

    // Return updated user data
    return getById(user._id);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

async function login(userCred) {
  try {
    // First check if the user exists
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', userCred.username);
    
    if (fetchError) throw fetchError;
    
    if (!users || users.length === 0) {
      return Promise.reject('Invalid username or password');
    }
    
    const user = users[0];
    
    // For a real app you'd use Supabase auth with passwords
    // Here we're just doing a simple username match for migration
    return saveLocalUser({
      _id: user.id,
      username: user.username,
      fullname: user.fullname,
      imgUrl: user.img_url,
      isBarber: user.is_barber
    });
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

async function signup(userCred) {
  try {
    // Check if user exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('username', userCred.username);
    
    if (checkError) throw checkError;
    
    if (existingUsers && existingUsers.length > 0) {
      toast.error('Username already exists');
      return;
    }
    
    // Insert new user
    const { data: userData, error: insertError } = await supabase
      .from('users')
      .insert({
        username: userCred.username,
        fullname: userCred.fullname,
        img_url: userCred.imgUrl,
        is_barber: userCred.isBarber || false,
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // If this is a barber, create work days
    if (userCred.isBarber) {
      // Call the PostgreSQL function to create default work days
      const { error: workDaysError } = await supabase.rpc('create_default_work_days', {
        p_user_id: userData.id
      });
      
      if (workDaysError) throw workDaysError;
    }
    
    // Return the new user
    return saveLocalUser({
      _id: userData.id,
      username: userData.username,
      fullname: userData.fullname,
      imgUrl: userData.img_url,
      isBarber: userData.is_barber
    });
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
}

async function logout() {
  sessionStorage.removeItem(STORAGE_KEY_LOGGEDIN_USER);
  // In a real app, you'd also sign out from Supabase Auth
  // await supabase.auth.signOut();
}

function saveLocalUser(user) {
  const returnUser = {
    _id: user._id,
    username: user.username,
    fullname: user.fullname,
    imgUrl: user.imgUrl,
    workDays: user.workDays,
    reservations: user.reservations,
    isBarber: user.isBarber,
  }
  sessionStorage.setItem(STORAGE_KEY_LOGGEDIN_USER, JSON.stringify(returnUser))
  return returnUser
}

function getLoggedinUser() {
  return JSON.parse(sessionStorage.getItem(STORAGE_KEY_LOGGEDIN_USER))
}

async function _createLocalUser() {
  try {
    const { data: users } = await getUsers();
    
    if (!users || users.length === 0) {
      console.log('creating local user');
      toast.info('Creating initial barber');
      await signup({ 
        fullname: 'Ramel Lausani', 
        username: "ramel", 
        password: 'ramel123', 
        isBarber: true, 
        imgUrl: 'https://iili.io/JxtxGON.md.jpg' 
      });
    } else {
      console.log('barbershop users exist');
    }
  } catch (error) {
    console.error('Error creating local user:', error);
  }
}

function getEmptyCredentials() {
  return {
    username: '',
    password: '',
    fullname: '',
    imgUrl: ''
  }
}

async function demoUser() {
  return {
    username: 'demo',
    password: 'demo123',
  }
}