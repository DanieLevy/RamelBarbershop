# Ramel Barbershop

A React application for booking appointments at Ramel Barbershop. This application uses Supabase as the backend service for data storage and Firebase for phone authentication.

## Features

- Barber directory with photos and information
- Appointment booking system
- OTP phone verification
- Responsive design
- Barber login for managing appointments

## Tech Stack

- **Frontend**: React with Vite
- **State Management**: Redux
- **Backend**: Supabase (PostgreSQL database)
- **Authentication**: Firebase (Phone verification)
- **Styling**: SCSS

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

## Supabase Integration

This project has been migrated from a traditional REST API backend to Supabase. For detailed information about the migration process, see [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md).

Key components for the Supabase integration:

- `src/supabase/supabaseClient.js` - Supabase client configuration
- `src/supabase/supabaseAuth.js` - Authentication utilities
- `src/services/user.service.js` - User management with Supabase
- `src/services/reservation.service.js` - Reservation management with Supabase

## Project Structure

- `src/pages` - Main page components
- `src/cmps` - Reusable UI components
- `src/store` - Redux store configuration
- `src/services` - API services and utilities
- `src/assets` - Static assets (images, styles)
- `src/supabase` - Supabase configuration and utilities

## Development

This project uses Vite for development with HMR. Two official plugins are included:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
