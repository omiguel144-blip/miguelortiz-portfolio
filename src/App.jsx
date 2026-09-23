import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Resume from './pages/Resume.jsx'
import Contact from './pages/Contact.jsx'

// Admin only exists in dev — it's excluded from the production bundle.
const Admin = import.meta.env.DEV ? lazy(() => import('./pages/Admin.jsx')) : null

function ScrollToTop() {
  const { pathname } = useLocation()
  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/contact" element={<Contact />} />
          {Admin && (
            <Route
              path="/admin"
              element={
                <Suspense fallback={<div className="container page">Loading admin…</div>}>
                  <Admin />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
