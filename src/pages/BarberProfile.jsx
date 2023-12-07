import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router';
import { loadUsers } from '../store/actions/user.actions';
import moment from 'moment';
import { utilService } from '../services/util.service';
import OtpInput from 'react-otp-input';
import { updateUser } from '../store/actions/user.actions';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import he from 'date-fns/locale/he';
import { set } from 'date-fns';
import { toast } from 'react-toastify';
import { is } from 'date-fns/locale';
import io from 'socket.io-client';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase/setup';
import { OTPCodeCmp } from '../cmps/OTPCode';

const socket = io.connect('http://localhost:5000');


export function BarberProfile() {
    const { barberId } = useParams();
    const overlayRef = useRef(null);
    const navigate = useNavigate();
    // ref for form btn to use it to submit the form from the next btn in footer
    // this ref i need to attach to the form btn and then click it from the next btn in footer
    const nextBtnRef = useRef(null);
    const users = useSelector((storeState) => storeState.userModule.users);
    const dispatch = useDispatch();
    const [barber, setBarber] = useState(null);
    const [resStep, setResStep] = useState(1);
    const [OTPCode, setOTPCode] = useState(null);
    const [enteredCode, setEnteredCode] = useState(null);
    const [datesModal, setDatesModal] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const [reservation, setReservation] = useState({
        service: null,
        date: {
            dayName: '',
            dayNum: '',
            dateTimestamp: null,
            timeTimestamp: null,
        },
        user: {
            fullname: '',
            phone: null,
        },
    });

    useEffect(() => {
        window.addEventListener('click', handleClickOutside);
        return () => {
            window.removeEventListener('click', handleClickOutside);
        };
    }, [isInputFocused]);


    useEffect(() => {
        if (!users || !users.length) {
            console.log('no users');
            loadUsers();
            return;
        }
        const barberUser = users.find((user) => user._id === barberId) || null;
        setBarber(barberUser);
    }, [barberId, users]);

    // connect to the socket server
    useEffect(() => {
        socket.on('barberUpdated', (updatedBarber) => {
            console.log('Received barberUpdated event from client side:', updatedBarber);
            // Handle the updated barber data as needed
        });

        return () => {
            // Clean up the event listener when the component unmounts
            socket.off('barberUpdated');
        };
    }, [socket]);


    function onServiceClick(opt) {
        setReservation({ ...reservation, service: opt });
        setResStep(2);
    }

    function onDayClick(day) {
        renderTimeSlots(day);
        setReservation({ ...reservation, date: { ...reservation.date, ...day } });
        setResStep(3);
    }

    function onTimeClick(time) {
        setReservation({ ...reservation, date: { ...reservation.date, timeTimestamp: time } });
        setResStep(4);
    }

    function handleSubmit(ev) {
        ev.preventDefault();
        setReservation({ ...reservation, user: { fullname: ev.target[0].value, phone: ev.target[1].value } });

        const OTPCode = utilService.getRandomOTP();
        setOTPCode(OTPCode);
        setResStep(5);
    }

    async function onUpdateUser(user) {
        try {
            console.log('onUpdateUser user', user);
            await updateUser(user);
            toast.success('התור נקבע בהצלחה!');
            setResStep(6);
        } catch (err) {
            console.log('err', err);
            toast.error('אירעה שגיאה, נסה שוב מאוחר יותר');
        }
    }


    function handleFullSubmit() {
        if (enteredCode === OTPCode) {
            //  build full reservation object -
            const fullReservation = {
                _id: utilService.makeId(),
                customer: reservation.user,
                barberId: barber._id,
                service: reservation.service,
                date: {
                    dayName: reservation.date.dayName,
                    dayNum: reservation.date.dayNum,
                    dateTimestamp: reservation.date.dateTimestamp,
                    timeTimestamp: reservation.date.timeTimestamp,
                },
            };

            console.log('fullReservation', fullReservation);
            barber.reservations.push(fullReservation);
            const user = { ...barber };
            onUpdateUser(user);
        } else {
            toast.error('הקוד שהוזן אינו נכון');
        }
    }



    function formatTime(time) {
        const timestamp = moment.unix(time);
        const timeStr = timestamp.format('HH:mm');
        return timeStr;
    }

    const ReserveationOpt = utilService.getReserveationOpt();

    function renderTimeSlots(baseTimestamp) {
        const hoursObject = generateHalfHourTimestamps(baseTimestamp.dateTimestamp);
        return hoursObject.map(timestamp => ({
            timestamp,
            isTaken: isTimeTaken(baseTimestamp, timestamp)
        }));
    }

    function renderWeekDates() {
        const weekDates = utilService.getNextWeekDates();
        weekDates.forEach(date => {
            const dayName = moment.unix(date.dateTimestamp).format('dddd').toLowerCase();
            if (!barber.workDays[dayName].isWorking) date.isWorking = false;
        });
        return weekDates;
    }

    function isTimeTaken(day, time) {
        const isTimeTaken = barber.reservations.some(res =>
            res.date.dayName === day.dayName && res.date.timeTimestamp === time);
        return isTimeTaken;
    }

    function generateHalfHourTimestamps(baseTimestamp) {
        const baseDate = moment.unix(baseTimestamp);
        const dayName = baseDate.format('dddd').toLowerCase();

        const startTime = moment(barber.workDays[dayName].workHours.start, 'HH:mm');
        const endTime = moment(barber.workDays[dayName].workHours.end, 'HH:mm');

        const timestamps = [];

        let currentTimestamp = startTime.clone();
        while (currentTimestamp.isBefore(endTime)) {
            timestamps.push(currentTimestamp.unix());
            currentTimestamp.add(30, 'minutes');
        }

        return timestamps;
    }

    function isNextBtnDisabled() {
        if (resStep === 1 && reservation.service === null) return true;
        if (resStep === 2 && reservation.date.dayName === '' && reservation.date.dayNum === '') return true;
        if (resStep === 3 && reservation.date.timeTimestamp === null) return true;
        if (resStep === 4 && reservation.user.fullname === '' && reservation.user.phone === null) return true;
        // check phone length only if phone is not null or undefined
        if (resStep === 4 && reservation.user.phone && reservation.user.phone.length !== 10) return true;
        if (resStep === 4 && reservation.user.phone === "") return true;
        if (resStep === 4 && reservation.user.phone === null) return true;

        if (resStep === 4 && reservation.user.fullname === "") return true;

        if (resStep === 5 && enteredCode === null) return true;
        // only if entredcode, check if length is not equal to 4
        if (resStep === 5 && enteredCode && enteredCode.length !== 4) return true;
        // only if we have otpcode, check if the entered code is not equal to the otpcode
        if (resStep === 5 && OTPCode && enteredCode !== OTPCode) return true;

        return false;
    }

    const toggleModal = () => {
        setDatesModal(!datesModal);
    };

    const handleOverlayClick = (event) => {
        if (event.target === overlayRef.current) {
            toggleModal();
        }
    };

    function onDayPickerClick(dayPickerOutput) {
        moment.locale('he');
        const parsedDate = moment(dayPickerOutput);
        const formattedDate = parsedDate.format('DD/MM');
        const dayName = parsedDate.format('dddd');
        const dateTimestamp = parsedDate.format('X');

        const date = {
            dayName: utilService.getDayNameInHebrew(dayName),
            dayNum: formattedDate,
            dateTimestamp: +dateTimestamp,
        };

        // Dont remove the prev date object, just add the new data to it
        setReservation({ ...reservation, date: { ...reservation.date, ...date } });
        setResStep(3);
        toggleModal();
    }

    function getNextBtnText() {
        if (resStep === 1) return 'הבא';
        if (resStep === 2) return 'הבא';
        if (resStep === 3) return 'הבא';
        if (resStep === 4) return 'קבל קוד אימות';
        if (resStep === 5) return 'קבע תור!';
        return 'הבא';
    }

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [isInputFocused]);

    const handleFocus = () => {
        setIsInputFocused(true);
    };

    const handleBlur = () => {
        setIsInputFocused(false);
    };

    const handleFocus2 = () => {
        window.scrollTo(0, 0);
    };

    const handleBlur2 = () => {
        window.scrollTo(0, 0);
    };

    const handleClickOutside = (e) => {
        if (isInputFocused && e.target.closest('.reservation-auth-input') === null) {
            // Clicked outside the input field, so blur the input
            document.activeElement.blur();
        }
    };

    const disabledDays =
        [
            {
                before: new Date(),
            },
            {
                after: moment().add(1, 'month').toDate(),
            },
        ];

    if (!barber) return <div className='barber-profile main-layout'>Barber not found</div>;

    return (
        <React.Fragment>
            <div className="barber-profile main-layout">
                <div className="barber-profile-header">
                    <div className='res-summary'>
                        <h3 className='res-summary-title'>התור שלך:</h3>
                        <div className='res-summary-content'>
                            <div className='res-summary-item'>
                                <div className='res-summary-item-title'>סוג:</div>
                                <div className='res-summary-item-content'>{reservation.service?.title || 'לא נבחר'}</div>
                            </div>
                            <div className='res-summary-item'>
                                <div className='res-summary-item-title'>תאריך:</div>
                                {/* if no date, say not selected */}
                                <div className='res-summary-item-content'>
                                    {{ date: reservation.date?.dayName ? `${reservation.date.dayName}, ${reservation.date.dayNum}` : 'לא נבחר' }.date}
                                </div>

                            </div>
                            <div className='res-summary-item'>
                                <div className='res-summary-item-title'>שעה:</div>
                                <div className='res-summary-item-content'>
                                    {{ timeTimestamp: reservation.date?.timeTimestamp ? formatTime(reservation.date.timeTimestamp) : 'לא נבחר' }.timeTimestamp}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <section className="barber-profile-body">
                    <div className="barber-profile-content">
                        <div className="barber-profile-reservation">
                            {resStep === 1 && <div className="reservation-step-1">
                                <h3>
                                    בחר את סוג התור:
                                </h3>

                                {ReserveationOpt.map(opt =>
                                    <button
                                        className={`reservation-opt ${reservation.service?.title === opt.title ? 'selected' : ''}`}
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
                                <h3 className='step-title'>
                                    באיזה יום?
                                </h3>

                                <div className="week-days">
                                    {renderWeekDates().map((date, idx) => (
                                        <button key={idx} className={`reservation-day ${reservation.date.dayNum === date.dayNum ? 'selected' : ''}`}
                                            onClick={() => onDayClick(date)}
                                            disabled={date.isWorking === false}
                                            // when mouse hover on the day, show the day name

                                            title={`${date.dayName} ${date.isWorking === false ? '(המספרה סגורה)' : ''}`}
                                        >
                                            <div className="day-label">{date.dayName}</div>
                                            <div className="day-num">{date.dayNum}</div>
                                        </button>
                                    ))}
                                </div>
                                <div className="more-dates">
                                    <div className='more-dates-btn'
                                        onClick={toggleModal}
                                    >
                                        <div className='more-dates-btn-text'>לתאריכים נוספים</div>
                                        <div className='more-dates-btn-icon'>
                                            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 16 16" version="1.1" data-view-component="true"><path fillRule="evenodd" d="M1.22 8a.75.75 0 0 1 0-1.06L6.47 2.7a.75.75 0 1 1 1.06 1.06L3.81 7h10.44a.75.75 0 0 1 0 1.5H3.81l3.72 3.72a.75.75 0 1 1-1.06 1.06L1.22 8Z"></path></svg>
                                        </div>
                                    </div>
                                    {datesModal &&
                                        <>
                                            <div className="overlay"
                                                ref={overlayRef}
                                                onClick={handleOverlayClick}
                                            ></div>
                                            <div className='more-dates-modal'>
                                                {/*render months using day picker*/}
                                                <DayPicker
                                                    dir="rtl"
                                                    locale={he}
                                                    numberOfMonths={1}
                                                    selected={reservation.date?.dateTimestamp ? new Date(reservation.date.dateTimestamp * 1000) : Date.now()}
                                                    onDayClick={onDayPickerClick}
                                                    disabled={disabledDays}

                                                />

                                            </div>
                                        </>
                                    }
                                </div>
                            </div>}

                            {resStep === 3 && <div className="reservation-step-3">
                                <h3 className='step-title'>
                                    באיזה שעה?
                                </h3>
                                <div className="time-slots">
                                    {renderTimeSlots(reservation.date).map(({ timestamp, isTaken }, idx) => (
                                        <button
                                            key={idx}
                                            disabled={isTaken}
                                            className={`time-slot ${reservation.date.timeTimestamp === timestamp ? 'selected' : ''}`}
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
                                <h3 className='step-title'>
                                    פרטים אישיים:
                                </h3>

                                <div className="reservation-form-container">
                                    <form
                                        className="reservation-form"
                                        onSubmit={handleSubmit}
                                    >
                                        <input type="text"
                                            required
                                            pattern='[a-zA-Zא-ת\s]*'
                                            inputMode="text"
                                            onFocus={handleFocus2}
                                            onBlur={handleBlur2}
                                            onChange={(ev) => setReservation({ ...reservation, user: { ...reservation.user, fullname: ev.target.value } })}
                                            value={reservation.user?.fullname || ''}
                                            placeholder="שם מלא" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="מספר טלפון"
                                            pattern='[0-9]*'
                                            inputMode="text"
                                            maxLength="10"
                                            minLength="10"
                                            onFocus={handleFocus2}
                                            onBlur={handleBlur2}
                                            // onChange, set the phone number to the user object in reservation with all the numbers include the first numbers that get into the string 
                                            onChange={(ev) => setReservation({ ...reservation, user: { ...reservation.user, phone: ev.target.value } })}

                                            value={reservation.user?.phone || ''}
                                        />
                                        <button
                                            ref={nextBtnRef}
                                            type='submit'
                                            style={{ display: 'none' }}
                                        >שלח</button>
                                    </form>
                                </div>
                                <OTPCodeCmp />
                            </div>}

                            {resStep === 5 && <div className="reservation-step-5">
                                <h3 className='step-title'>
                                    קוד אימות נשלח לטלפון שלך
                                </h3>
                                <div className="reservation-auth">
                                    <div className="reservation-auth-text">
                                        {OTPCode}
                                    </div>
                                    <div className="reservation-auth-input">
                                        <OtpInput
                                            containerStyle='otp-container'
                                            value={enteredCode}
                                            onChange={(code) => setEnteredCode(code)}
                                            numInputs={4}
                                            // handle dir ltr
                                            isInputNum={true}
                                            renderSeparator={<span>-</span>}
                                            // add uniq classname for filled input
                                            // handle the input to show numbers keyboard on mobile
                                            renderInput={(props) => <input
                                                {...props}
                                                type="number"
                                                maxLength="1"
                                                pattern="\d*"
                                                inputMode="numeric"
                                                onFocus={(ev) => (handleFocus(ev), handleFocus2(ev))}
                                                onBlur={(ev) => (handleBlur(ev), handleBlur2(ev))}
                                                className={`otp-input ${/\d/.test(props.value) ? 'has-number' : ''}`}
                                            />}
                                        />
                                    </div>
                                </div>
                            </div>}
                            {resStep === 6 && <div className="reservation-step-6">
                                <h3 className='step-title'>
                                    התור נקבע בהצלחה!
                                </h3>
                                {/* add some information about the res and link to cancel the res (hardcoded for now) */}
                                <div className="reservation-success">
                                    <div className="reservation-success-text">
                                        <p>התור נקבע בהצלחה!</p>
                                        <p>התור נקבע בשם: {reservation.user.fullname}</p>
                                        <p>בתאריך: {reservation.date.dayNum}</p>
                                        <p>בשעה: {formatTime(reservation.date.timeTimestamp)}</p>
                                    </div>
                                    <div className="reservation-success-btns">
                                        <button className='reservation-success-btn cancel'>ביטול תור</button>
                                        <button className='reservation-success-btn'>הורד אישור תור</button>
                                    </div>
                                </div>
                            </div>
                            }

                            {resStep === '100' && <div className="reservation-step-100">
                                <OTPCode 
                                phoneNumber={reservation.user.phone}
                                setOTPCode={setOTPCode}
                                 />
                                </div>

                            }
                        </div>
                    </div>
                </section>
            </div >
            <div className="barber-profile-footer">
                <div className='progress-bar'>
                    <div className='progress-bar-line' style={{ width: `${resStep * 25}%` }}></div>
                </div>
                <div className="nav-container">
                    <div className="nav-steps">
                        {/* control the steps of the reservation */}
                        <button className="nav-btn back"
                            onClick={() => {
                                if (resStep === 1) navigate('/');
                                setResStep(resStep - 1)
                            }
                            }

                        >
                            {resStep === 1 ? 'ביטול' : 'הקודם'}
                        </button>
                        <button className="nav-btn next"
                            disabled={isNextBtnDisabled()}
                            onClick={() => {
                                if (resStep === 3) toggleModal();
                                if (resStep === 4) {
                                    // nextBtnRef.current.click();
                                    // setResStep(resStep + 1)
                                    setResStep('100');

                                    return;
                                }
                                if (resStep === 5) {
                                    handleFullSubmit();
                                    return;
                                }
                                setResStep(resStep + 1)
                            }
                            }
                        // type={resStep === 4 ? 'submit' : 'button'}
                        >
                            {getNextBtnText()}
                        </button>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}
