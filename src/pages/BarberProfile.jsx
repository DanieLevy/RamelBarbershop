import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router';
import { loadUsers } from '../store/actions/user.actions';
import moment from 'moment';
import { utilService } from '../services/util.service';
import 'moment/locale/he'; // Import the Hebrew locale

import { updateUser } from '../store/actions/user.actions';

import { format, set } from 'date-fns';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { is } from 'date-fns/locale';

export function BarberProfile() {
    const { barberId } = useParams();
    const users = useSelector((storeState) => storeState.userModule.users);
    const [barber, setBarber] = useState(null);
    const [resStep, setResStep] = useState(1);
    const [OTPCode, setOTPCode] = useState(null);
    const [reservation, setReservation] = useState({
        service: null,
        date: null
    });

    useEffect(() => {
        if (!users || !users.length) {
            loadUsers();
            return;
        }

        const barberUser = users.find((user) => user._id === barberId) || null;
        setBarber(barberUser);
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

    function onTimeClick(time) {
        console.log('time', time);
        // add to reservation object the time of the reservation under the key 'date' with all the other data of date
        setReservation({ ...reservation, date: { ...reservation.date, timeTimestamp: time } });
        setResStep(4);
    }

    function handleSubmit(ev) {
        ev.preventDefault();
        setReservation({ ...reservation, user: { fullname: ev.target[0].value, phone: +ev.target[1].value } });
        console.log('reservation', reservation);
        // generate random code and save it into state
        // random code -
        const OTPCode = utilService.getRandomOTP();
        setOTPCode(OTPCode);
        setResStep(5);
    }

    function handleFullSubmit(ev) {
        ev.preventDefault();
        console.log('OTPCode', OTPCode);
        console.log('ev.target[0].value', ev.target[0].value);
        if (ev.target[0].value === OTPCode) {

            //  build full reservation object -
            const fullReservation = {
                _id: utilService.makeId(),
                customer: reservation.user,
                barberId: barber._id,
                service: reservation.service,
                date: reservation.date,
            }
            console.log('fullReservation', fullReservation);

            // update user in db using updateUser action
            const user = {
                ...barber,
                reservations: [...barber.reservations, fullReservation]
            }
            updateUser(user);
            console.log('User updated!');
            console.log('user', user);

        } else {
            alert('Wrong code');;
        }
    }



    function formatTime(time) {
        const timestamp = moment.unix(time);
        const timeStr = timestamp.format('HH:mm');
        return timeStr;
    }

    const ReserveationOpt = utilService.getReserveationOpt();

    function renderTimeSlots(baseTimestamp) {
        // console.log('baseTimestamp', baseTimestamp);
        const hoursObject = generateHalfHourTimestamps(baseTimestamp.dateTimestamp);
        console.log('hoursObject', hoursObject);
        return hoursObject;
    }

    function renderWeekDates() {
        const weekDates = utilService.getNextWeekDates();
        weekDates.forEach(date => {
            const dayName = moment.unix(date.dateTimestamp).format('dddd').toLowerCase();
            if (!barber.workDays[dayName].isWorking) date.isWorking = false;
        });
        return weekDates;
    }

    function isTimeTaken(time) {
        const isTimeTaken = barber.reservations.some(res => res.date.timeTimestamp === time);
        return isTimeTaken;
    }

    function generateHalfHourTimestamps(baseTimestamp) {
        console.log('baseTimestamp', baseTimestamp);
        const baseDate = moment.unix(baseTimestamp);
        const dayName = baseDate.format('dddd').toLowerCase();

        const startTime = moment(barber.workDays[dayName].workHours.start, 'HH:mm');
        const endTime = moment(barber.workDays[dayName].workHours.end, 'HH:mm');

        const timestamps = [];

        // Generate timestamps for each half-hour between start and end time
        let currentTimestamp = startTime.clone();
        while (currentTimestamp.isBefore(endTime)) {
            timestamps.push(currentTimestamp.unix());
            currentTimestamp.add(30, 'minutes');
        }

        return timestamps;
    }

    // function handleClick(ev) {
    //     // handle click to save to user in db using updateUser action
    //     console.log('ev.target', ev.target);
    //     const user = {
    //         ...barber,
    //         reservations: [...barber.reservations, reservation]
    //     }
    // }


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
                        {renderWeekDates().map((date, idx) => (
                            console.log('date', date),
                            <button key={idx} className="reservation-days"
                                onClick={() => onDayClick(date)}
                                // if day has ket isWorking and is false - disable button, else - enable button
                                disabled={date.isWorking === false}
                                
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
                                <button key={idx}
                                    disabled={isTimeTaken(timestamp)}
                                    className="time-slot"
                                    onClick={() => onTimeClick(timestamp)}
                                >
                                    {formatTime(timestamp)}
                                </button>
                            ))}
                        </div>

                    </div>}

                    {/*  Step 4 - Summary of reservation, and validation of the reservation -
                    Need to put Fullname and phone number, then submit. */}
                    {resStep === 4 && <div className="reservation-step-4">
                        Step 4 - Summary of reservation, and validation of the reservation
                        <h1>
                            {reservation.service.title}
                        </h1>
                        <h2>
                            {reservation.date.dayName} {reservation.date.dayNum} {reservation.date.monthName}
                        </h2>
                        <h3>
                            {reservation.time}

                        </h3>

                        <div className="reservation-form">
                            <form onSubmit={handleSubmit}>
                                <input type="text"
                                    required
                                    pattern='[a-zA-Zא-ת\s]*'
                                    value={reservation.user.fullname || ''}
                                    placeholder="שם מלא" />
                                <input type="text"
                                    required
                                    pattern="[0-9]*"
                                    placeholder="מספר טלפון"
                                    value={reservation.user.phone || ''}
                                />
                                <button>שלח</button>
                            </form>
                        </div>
                    </div>}

                    {resStep === 5 && <div className="reservation-step-5">
                        Step 5 - validate using 4 number random code hard coded
                        <h1>
                            {reservation.service.title}
                        </h1>
                        <h2>
                            {reservation.date.dayName} {reservation.date.dayNum} {reservation.date.monthName}
                        </h2>
                        <h3>
                            {reservation.time}
                        </h3>
                        <div className="reservation-form">
                            <form onSubmit={handleFullSubmit}>
                                <input type="text" placeholder="קוד אימות" />
                                <button>שלח</button>
                            </form>
                        </div>
                    </div>}
                </div>
            </div>
        </div >
    );
}
