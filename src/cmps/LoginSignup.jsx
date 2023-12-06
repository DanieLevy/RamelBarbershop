import { useState } from "react";
import React from "react";
import { userService } from "../services/user.service";
import UploadButtonComponent from "./NewImgUploader";

export function LoginSignup(props) {
  const {
    isSignup,
    onToggleLogin,
    login,
    signup,
    setSignupModal,
    setImgUrl,
    closeModal,
  } = props;

  const [credentials, setCredentials] = useState(
    userService.getEmptyCredentials()
  );

  function handleUploadComplete(img_Url) {
    const currectUrl = RegExp(/http/).test(img_Url);
    if (!currectUrl) return;
    setCredentials({ ...credentials, imgUrl: img_Url[0] });
  }

  function clearState() {
    setCredentials({ username: "", password: "", fullname: "", imgUrl: "" });
  }

  function handleChange(ev) {
    const field = ev.target.name;
    const value = ev.target.value;

    if (field === "isBarber") {
      (ev.target.checked) ? setCredentials({ ...credentials, [field]: true }) : setCredentials({ ...credentials, [field]: false })
      return
    }
    setCredentials({ ...credentials, [field]: value });
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (isSignup) {
      if (
        !credentials.username ||
        !credentials.password ||
        !credentials.fullname ||
        !credentials.email
      )
        return console.log("All fields are required"), clearState();
        // if isBarber checked, add reservations empty array to user, else dont add
      if (credentials.isBarber) {
        credentials.reservations = [
          {
            date: "",
            time: "",
            customer: {
              fullname: "",
              phone: "",
              email: "",
            },
          }
        ]
      }

      signup(credentials);
    } else {
      if (!credentials.username || !credentials.password)
        return alert("All fields are required"), clearState();
      login(credentials);
    }
  }

  function toggleSignup() {
    setSignupModal((prev) => !prev);
  }

  return (
    <>
      <div className="modal-backdrop" onClick={() => closeModal()}></div>
      <div className="login-modal">
        <div className="login-modal-header">
          <span className="close-btn" onClick={() => onToggleLogin(false)}>
            &times;
          </span>
          <div>{isSignup ? "Sign Up" : "Log in"}</div>
        </div>
        {/* <form onSubmit={isSignup ? onSignup : onLogin} className="login-form"> */}
        <form onSubmit={onSubmit} className="login-form">
          {isSignup && (
            <label htmlFor="fullname">
              <span className="red-dot">*</span> Full Name:
            </label>
          )}
          {isSignup && (
            <input
              type="text"
              name="fullname"
              className="input input-fullname"
              // value={credentials.fullname}
              onChange={handleChange}
              required
            />
          )}
          <label htmlFor="username">
            <span className="red-dot">*</span> Username:
          </label>
          <input
            type="text"
            name="username"
            className="input input-username"
            onChange={handleChange}
            required
          />
          {isSignup && (
            <label htmlFor="email">
              <span className="red-dot">*</span> Email:
            </label>
          )}
          {isSignup && (
            <input
              type="email"
              name="email"
              className="input input-email"
              onChange={handleChange}
              required
            />
          )}
          <label htmlFor="password">
            <span className="red-dot">*</span> Password:
          </label>
          <input
            type="password"
            name="password"
            className="input input-password"
            onChange={handleChange}
            required
          />
          {isSignup && (
            <label htmlFor="isBarber" className="isBarber">
              <span className="red-dot">*</span> Barber?:
              <input
                type="checkbox"
                name="isBarber"
                className="input input-isBarber"
                onChange={handleChange}
                required
              />
            </label>
          )}
          {/* {isSignup && <ImgUploader onUploaded={onUploaded} />} */}
          {credentials.imgUrl && isSignup && (
            <div>
              <div className="img-container flex align-center">
                <h1>
                  <span className="red-dot">*</span>
                  Avatar:{" "}
                </h1>
                <img
                  src={credentials.imgUrl}
                  className="uploaded-img"
                  style={{ marginInlineStart: ".5rem" }}
                />
              </div>

              <div>
                <span className="change-img-btn" onClick={() => setImgUrl("")}>
                  Change
                </span>
              </div>
            </div>
          )}

          {!credentials.imgUrl && isSignup && (
            <UploadButtonComponent onComplete={handleUploadComplete} />
          )}

          <button className="btn btn-primary" type="submit">
            {isSignup ? "Sign Up" : "Log in"}
          </button>
        </form>

        <div className="divider-container">
          <div className="divider-line"></div>
          <div className="divider-text">or</div>
          <div className="divider-line"></div>
        </div>
        <div className="footer-btn flex align-center justify-center">
          <button
            className="btn"
            onClick={() => {
              userService
                .demoUser()
                .then((user) => {
                  setCredentials(user);
                  return user;
                })
                .then(login);
            }}
          >
            Demo Login (As Guest)
          </button>

          <button className="btn btn-secondary" onClick={toggleSignup}>
            {isSignup ? "Login" : "Sign Up"}
          </button>
        </div>
      </div>
    </>
  );
}
