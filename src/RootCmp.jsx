import React from 'react'
import { Routes, Route } from 'react-router'
import routes from './routes'
import { AppHeader } from './cmps/AppHeader'
import { UserMsg } from './cmps/UserMsg'
import { ToastContainer } from 'react-toastify';

export function RootCmp() {
  return (
    <React.Fragment>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <AppHeader />
      <Routes>
        {routes.map((route) => (
          <Route key={route.path} exact={true} element={route.component} path={route.path} />
        ))}
      </Routes>
      {/* <AppFooter /> */}
      <UserMsg />
    </React.Fragment>
  )
}
