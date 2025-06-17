# Ramel Barbershop - Supabase Migration

This document outlines the migration of the Ramel Barbershop application from its previous backend (hosted on Render) to Supabase.

## Database Schema

### Tables

1. **users**
   - `id` - UUID (Primary Key)
   - `auth_id` - UUID for auth integration (optional)
   - `username` - TEXT (Unique)
   - `fullname` - TEXT
   - `img_url` - TEXT
   - `is_barber` - BOOLEAN
   - `phone` - TEXT
   - `created_at` - TIMESTAMP
   - `updated_at` - TIMESTAMP

2. **work_days**
   - `id` - UUID (Primary Key)
   - `user_id` - UUID (Foreign Key to users)
   - `day_of_week` - TEXT (e.g., 'sunday', 'monday', etc.)
   - `is_working` - BOOLEAN
   - `start_time` - TEXT (format: '09:00')
   - `end_time` - TEXT (format: '20:00')

3. **services**
   - `id` - UUID (Primary Key)
   - `name` - TEXT
   - `description` - TEXT
   - `duration` - INTEGER (in minutes)
   - `price` - DECIMAL

4. **reservations**
   - `id` - UUID (Primary Key)
   - `barber_id` - UUID (Foreign Key to users)
   - `service_id` - UUID (Foreign Key to services)
   - `customer_name` - TEXT
   - `customer_phone` - TEXT
   - `date_timestamp` - BIGINT (Unix timestamp)
   - `time_timestamp` - BIGINT (Unix timestamp)
   - `day_name` - TEXT
   - `day_num` - TEXT
   - `status` - TEXT (e.g., 'confirmed', 'completed', 'cancelled')
   - `created_at` - TIMESTAMP

## Custom Functions

### `create_default_work_days`
Creates a default work schedule for a new barber, setting up their availability for each day of the week.

### `get_available_time_slots`
Finds available appointment slots for a specific barber on a specific date, taking into account their working hours and existing appointments.

## Frontend Changes

1. Created a Supabase client configuration in `src/supabase/supabaseClient.js`
2. Updated user service to use Supabase queries instead of HTTP requests
3. Created a new supabaseAuth.js utility for authentication that works with Firebase phone verification
4. Added a dedicated reservation service for handling appointments
5. Updated Redux actions to work with the new service implementations
6. Modified the BarberProfile component to use the new services for booking appointments

## Authentication Flow

The application uses a hybrid authentication approach:
- Supabase for data storage and retrieval
- Firebase for phone number verification (OTP)

When a user books an appointment:
1. Basic user details are collected
2. Firebase sends an OTP to the user's phone
3. User verifies their identity by entering the OTP
4. Upon successful verification, the appointment is saved to Supabase

## Migration Steps

1. Created Supabase project
2. Designed and implemented database schema
3. Created necessary tables and relationships
4. Implemented custom PostgreSQL functions
5. Added seed data for services
6. Installed Supabase JS client
7. Created Supabase client configuration
8. Updated services to use Supabase
9. Updated components to work with the new services
10. Maintained Firebase for phone verification

## Future Improvements

1. Consider migrating fully to Supabase Auth with phone verification
2. Implement real-time updates using Supabase Realtime
3. Add user accounts for customers to view their appointment history
4. Implement admin dashboard for managing barbers and services
5. Add analytics using Supabase's PostgreSQL capabilities 