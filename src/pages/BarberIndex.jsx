import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { loadUsers } from "../store/actions/user.actions"

export function BarberIndex() {
    const users = useSelector((storeState) => storeState.userModule.users)

    useEffect(() => {
        loadUsers()
    }, [users])

    const barbers = users.filter(user => user.isBarber)
    console.log('barbers', barbers);

    return (
        <div className="barber-index main-layout">
            <div className="index-header">
                <div className="index-header-content">
                    <div className="index-header-txt">
                        <div className="index-header-title">
                            Welcome to Ramel Barbershop,
                            where timeless tradition meets modern style.
                            Our team of skilled barbers is dedicated to providing you with the finest grooming experience in town.
                        </div>
                        <div className="index-header-subtitle">
                            Step into our welcoming space,
                            infused with the rich aroma of fine grooming products and the classic ambiance that defines a true barbershop.
                        </div>
                    </div>
                    <div className="index-header-img">
                        <img src="https://i.postimg.cc/VvhynyMy/12.jpg"
                            alt="barber shop" />
                    </div>
                </div>
            </div>
            <div className="index-body">
                <div className="barbers-list">
                    {barbers.map(barber => <div className="barber-card" key={barber._id}>
                        <div className="barber-card-content">
                            <div className="barber-card-name">
                                {barber.fullname}
                            </div>
                            <div className="barber-card-btn">
                                <button>קבע תור</button>
                            </div>
                        </div>
                        <div className="barber-card-img">
                            <img src={barber.imgUrl} alt="" />
                        </div>
                    </div>)}
                </div>
            </div>
        </div>

    )
}