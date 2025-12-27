import { supabase } from '../supabase/supabaseClient';
import { utilService } from './util.service';
import moment from 'moment';

export const reservationService = {
  getReservationsByBarber,
  getReservationsByCustomerPhone,
  addReservation,
  updateReservation,
  cancelReservation,
  getAvailableTimeSlots,
};

async function getReservationsByBarber(barberId) {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        barber_id,
        service_id,
        customer_name,
        customer_phone,
        date_timestamp,
        time_timestamp,
        day_name,
        day_num,
        status,
        created_at,
        services(*)
      `)
      .eq('barber_id', barberId)
      .order('date_timestamp', { ascending: true });

    if (error) throw error;

    return formatReservations(data);
  } catch (error) {
    console.error('Error fetching reservations by barber:', error);
    throw error;
  }
}

async function getReservationsByCustomerPhone(phone) {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        barber_id,
        service_id,
        customer_name,
        customer_phone,
        date_timestamp,
        time_timestamp,
        day_name,
        day_num,
        status,
        created_at,
        services(*),
        users:barber_id(*)
      `)
      .eq('customer_phone', phone)
      .order('date_timestamp', { ascending: false });

    if (error) throw error;

    return formatReservations(data, true);
  } catch (error) {
    console.error('Error fetching reservations by customer:', error);
    throw error;
  }
}

async function addReservation(reservation) {
  try {
    // Get the service ID if we only have the name
    let serviceId = reservation.service._id;
    
    if (!serviceId) {
      const { data: serviceData } = await supabase
        .from('services')
        .select('id')
        .eq('name', reservation.service.name)
        .single();
      
      serviceId = serviceData?.id;
      
      if (!serviceId) {
        throw new Error('Service not found');
      }
    }
    
    // Format the reservation data for Supabase
    const reservationData = {
      id: reservation._id || utilService.makeId(),
      barber_id: reservation.barberId,
      service_id: serviceId,
      customer_name: reservation.customer.fullname,
      customer_phone: reservation.customer.phone,
      date_timestamp: reservation.date.dateTimestamp,
      time_timestamp: reservation.date.timeTimestamp,
      day_name: reservation.date.dayName,
      day_num: reservation.date.dayNum,
      status: 'confirmed'
    };
    
    const { data, error } = await supabase
      .from('reservations')
      .insert(reservationData)
      .select();
      
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error adding reservation:', error);
    throw error;
  }
}

async function updateReservation(reservation) {
  try {
    const { error } = await supabase
      .from('reservations')
      .update({
        status: reservation.status
      })
      .eq('id', reservation._id);
      
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating reservation:', error);
    throw error;
  }
}

async function cancelReservation(reservationId) {
  try {
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId);
      
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    throw error;
  }
}

async function getAvailableTimeSlots(barberId, dateTimestamp) {
  try {
    const { data, error } = await supabase.rpc('get_available_time_slots', {
      p_barber_id: barberId,
      p_date_timestamp: dateTimestamp
    });
    
    if (error) throw error;
    
    return data.map(slot => ({
      timestamp: slot.time_timestamp,
      available: slot.is_available,
      time: moment.unix(slot.time_timestamp).format('HH:mm')
    }));
  } catch (error) {
    console.error('Error getting available time slots:', error);
    throw error;
  }
}

// Helper function to format reservations
function formatReservations(data, includeBarber = false) {
  return data.map(res => {
    const formatted = {
      _id: res.id,
      customer: {
        fullname: res.customer_name,
        phone: res.customer_phone
      },
      barberId: res.barber_id,
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
      status: res.status,
      createdAt: res.created_at
    };
    
    if (includeBarber && res.users) {
      formatted.barber = {
        _id: res.users.id,
        fullname: res.users.fullname,
        imgUrl: res.users.img_url
      };
    }
    
    return formatted;
  });
} 