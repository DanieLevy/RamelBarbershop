import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router';
import { loadUsers } from '../store/actions/user.actions';
import moment from 'moment';
import { utilService } from '../services/util.service';
import 'moment/locale/he'; // Import the Hebrew locale

import { format } from 'date-fns';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

export function BarberProfile() {
    const { barberId } = useParams();
    const users = useSelector((storeState) => storeState.userModule.users);
    const [barber, setBarber] = useState(null);
    const [resStep, setResStep] = useState(1);
    const [reservation, setReservation] = useState({
        service: null,
        date: null
    });

    useEffect(() => {
        if (!users || !users.length) {
            loadUsers();
            return;
        }
        // Find barber by id, if not found return null
        const barber = users.find((user) => user._id === barberId) || null;
        // set barber to state
        setBarber(barber);

    }, [barberId, users]);

    useEffect(() => {
        console.log('reservation', reservation);
    }, [reservation]);


    function onServiceClick(opt) {
        setReservation({ ...reservation, service: opt });
        setResStep(2);
    }

    function onDayClick(day) {
        console.log('day', day);
        renderTimeSlots(day);
        setReservation({ ...reservation, date: day });
        setResStep(3);
    }

    const timeSlotDuration = 30 * 60 * 1000; // 30 minutes in milliseconds per time slot

    // Helper function to format time
    function formatTime(time) {
        const timestamp = moment.unix(time);
        const timeStr = timestamp.format('HH:mm');
        return timeStr;
    }


    const ReserveationOpt =
        [
            {
                title: 'Classic Haircut&Bread',
                duration: 30,
                price: 100
            },
            {
                title: 'SKIN/RAZOR FADE',
                duration: 30,
                price: 80
            },
            {
                title: 'Classic Bread',
                duration: 10,
                price: 50
            }
        ]

    const weekDates = utilService.getNextWeekDates();

    const workDays = {
        monday: {
            isWorking: true,
            workHours: { start: '09:00', end: '20:00' },
        },
        tuesday: {
            isWorking: true,
            workHours: { start: '09:00', end: '20:00' },
        },
        wednesday: {
            isWorking: true,
            workHours: { start: '09:00', end: '20:00' },
        },
        thursday: {
            isWorking: true,
            workHours: { start: '09:00', end: '20:00' },
        },
        friday: {
            isWorking: true,
            workHours: { start: '09:00', end: '14:00' },
        },
        saturday: {
            isWorking: false,
            workHours: null,
        },
        sunday: {
            isWorking: true,
            workHours: { start: '09:00', end: '20:00' },
        },
    }


    function renderTimeSlots(baseTimestamp) {
        const hoursObject = generateHalfHourTimestamps(baseTimestamp.timestamp);
        console.log('hoursObject', hoursObject);
        return hoursObject;
    }

    function generateHalfHourTimestamps(baseTimestamp) {
        const baseDate = moment.unix(baseTimestamp);
        const dayName = baseDate.format('dddd').toLowerCase();

        const startTime = moment(workDays[dayName].workHours.start, 'HH:mm');
        const endTime = moment(workDays[dayName].workHours.end, 'HH:mm');

        const timestamps = [];
      
        // Generate timestamps for each half-hour between start and end time
        let currentTimestamp = startTime.clone();
        while (currentTimestamp.isBefore(endTime)) {
          timestamps.push(currentTimestamp.unix());
          currentTimestamp.add(30, 'minutes');
        }
      
        return timestamps;
      }
      
      // Example usage
    //   const baseTimestamp = 1700577793;
    //   const generatedTimestamps = generateHalfHourTimestamps(baseTimestamp);
    //   console.log('gereneeee',generatedTimestamps);

    // console.log(renderTimeSlots(workHours, reservations), 'renderTimeSlots(workHours, reservations)');


    if (!barber) return <div className='barber-profile main-layout'>Barber not found</div>;

    return (
        <div className="barber-profile main-layout">
            <div className="barber-profile-name">{barber.fullname}</div>
            <div className="barber-profile-content">
                <div className="barber-profile-img">
                    <img src={barber.imgUrl} alt="" />
                </div>
                <div className="barber-profile-reservation">
                    {resStep === 1 && <div className="reservation-step-1">
                        Step 1 - Choose your service type
                        {ReserveationOpt.map(opt =>
                            <button
                                className="reservation-opt"
                                key={opt.title}
                                onClick={() => onServiceClick(opt)}
                            >
                                <div className="title">{opt.title}</div>
                                <div className='opt-container flex'>
                                    <div className="duration">זמן: {opt.duration} דק'</div>
                                    <div className="sep">|</div>
                                    <div className="price">מחיר: {opt.price} ש"ח</div>
                                </div>
                            </button>
                        )}
                    </div>}
                    {resStep === 2 && <div className="reservation-step-2">
                        Step 2 - Choose your date
                        <h1>
                            {/* {reservation.service.title} */}
                        </h1>
                        {/* Render one week forward (each day in a button) */}
                        {weekDates.map((date, idx) => (
                            <button key={idx} className="reservation-days"
                                onClick={() => onDayClick(date)}
                            >
                                <div className="day-label">{date.dayName}</div>
                                <div className="day-num">{date.dayNum}</div>
                            </button>
                        ))}
                        <div className="more-dates">
                            <div className='more-dates-btn'>תאריכים נוספים</div>
                            <div className='more-dates-list'>
                                {/*render months using day picker*/}
                                <DayPicker
                                    numberOfMonths={1}
                                    onDayClick={onDayClick}
                                    selectedDays={new Date()}
                                />

                            </div>
                        </div>
                    </div>}

                    {resStep === 3 && <div className="reservation-step-3">
                        Step 3 - Choose your time
                        <h1>
                            {reservation.service.title}
                        </h1>
                        <h2>
                            {reservation.date.dayName} {reservation.date.dayNum} {reservation.date.monthName}
                        </h2>
                        {/* render list of -
                        time slots acording to barber work hours and reservations - so if a time slot is taken it will be disabled
                        and if a time slot is not in work hours it will be disabled */}
                        <div className="time-slots">
                            {renderTimeSlots(reservation.date).map((timestamp, idx) => (
                                    console.log('timestamp', timestamp),
                                <button key={idx} className="time-slot">
                                    {formatTime(timestamp)}
                                </button>
                            ))}
                        </div>

                    </div>}
                </div>
            </div>
        </div >
    );
}
